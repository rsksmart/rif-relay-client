import log from 'loglevel';
import type {
    ContractInteractor,
    EnvelopingConfig,
    EnvelopingTransactionDetails,
} from '@rsksmart/rif-relay-common';
import type { IRelayHub } from '@rsksmart/rif-relay-contracts/dist/typechain-types';
import type { BigNumber } from 'ethers';
import type { TypedEvent } from '@rsksmart/rif-relay-contracts/dist/typechain-types/common';

export interface GenericEventObject {
    relayManager: string;
  }
  export type GenericEvent = TypedEvent<
    [string, string, BigNumber],
    GenericEventObject
  >;

export type RelayFilter = (relayData: IRelayHub.RelayManagerDataStruct) => boolean;
export type AsyncScoreCalculator = (
    relay: IRelayHub.RelayManagerDataStruct,
    txDetails: EnvelopingTransactionDetails,
    failures: RelayFailureInfo[]
) => Promise<number> | number;

export interface RelayFailureInfo {
    lastErrorTime: number;
    relayManager: string;
    relayUrl: string;
}


/**
 * Basic score is reversed higher is better.
 * Relays that failed to respond recently will be downgraded for some period of time.
 */
export const defaultRelayScore: AsyncScoreCalculator = function (
    relay: IRelayHub.RelayManagerDataStruct,
    txDetails: EnvelopingTransactionDetails,
    failures: RelayFailureInfo[]
): number {
    return Math.pow(0.9, failures.length);
};

export class KnownRelaysManager {
    private readonly contractInteractor: ContractInteractor;

    private readonly config: EnvelopingConfig;

    private readonly relayFilter: RelayFilter;

    private readonly scoreCalculator: AsyncScoreCalculator;

    private latestScannedBlock = 0;

    private relayFailures = new Map<string, RelayFailureInfo[]>();

    public relayLookupWindowParts: number;

    public preferredRelayers: IRelayHub.RelayManagerDataStruct[] = [];

    public allRelayers: IRelayHub.RelayManagerDataStruct[] = [];

    constructor(
        contractInteractor: ContractInteractor,
        config: EnvelopingConfig,
        relayFilter?: RelayFilter,
        scoreCalculator?: AsyncScoreCalculator
    ) {
        this.config = config;
        this.relayFilter = relayFilter ?? function() { return true };
        this.scoreCalculator = scoreCalculator ?? defaultRelayScore;
        this.contractInteractor = contractInteractor;
        this.relayLookupWindowParts = this.config.relayLookupWindowParts;
    }

    async refresh(): Promise<void> {
        this._refreshFailures();
        log.debug('KnownRelaysManager - Refresh failures done');
        const recentlyActiveRelayManagers =
            await this._fetchRecentlyActiveRelayManagers();
        log.debug(
            'KnownRelaysManager - Fetched recently active Relay Managers done'
        );
        this.preferredRelayers = this.config.preferredRelays.map((relayUrl) => {
            return {
                url: relayUrl,
                currentlyStaked: false,
                manager: '',
                registered: false,
            };
        });
        this.allRelayers = await this.getRelayDataForManagers(
            recentlyActiveRelayManagers
        );

        log.debug('KnownRelaysManager - Get relay info for Managers done');
        log.debug('KnownRelaysManager - Refresh done');
    }

    async getRelayDataForManagers(
        relayManagers: Set<string>
    ): Promise<IRelayHub.RelayManagerDataStruct[]> {
        if (relayManagers.size === 0) {
            return [];
        }
        const activeRelays = await this.contractInteractor.getActiveRelayInfo(
            relayManagers
        );
        // As 'topics' are used as 'filter', having an empty set results in querying all register events.

        return activeRelays.filter(this.relayFilter);
    }

    splitRange(
        fromBlock: number,
        toBlock: number,
        splits: number
    ): Array<{ fromBlock: number; toBlock: number }> {
        const totalBlocks = toBlock - fromBlock + 1;
        const splitSize = Math.ceil(totalBlocks / splits);

        const ret: Array<{ fromBlock: number; toBlock: number }> = [];
        let b;
        for (b = fromBlock; b < toBlock; b += splitSize) {
            ret.push({
                fromBlock: b,
                toBlock: Math.min(toBlock, b + splitSize - 1)
            });
        }

        return ret;
    }

    // return events from hub. split requested range into "window parts", to avoid
    // fetching too many events at once.
    getPastEventsForHub(
        fromBlock: number,
        toBlock: number
    ): Promise<TypedEvent[][]> {

        const rangeParts = this.splitRange(
            fromBlock,
            toBlock,
            this.relayLookupWindowParts
        );

        const pastEventsPromises = rangeParts.map(({ fromBlock, toBlock }) => {
            return this.contractInteractor.getPastEventsForHub({
                fromBlock,
                toBlock
            });
        });

        return Promise.all(pastEventsPromises).then((pastEventArray: TypedEvent[][][]) => {
            return pastEventArray.flat();
        });
    }

    async _fetchRecentlyActiveRelayManagers(): Promise<Set<string>> {
        const toBlock = await this.contractInteractor.getBlockNumber();
        const fromBlock = Math.max(
            0,
            toBlock - this.config.relayLookupWindowBlocks
        );

        const relayEvents = await this.getPastEventsForHub(
            fromBlock,
            toBlock
        );

        log.info(`fetchRelaysAdded: found ${relayEvents.length} events`);
        const foundRelayManagers: Set<string> = new Set();
        relayEvents.forEach((eventList: GenericEvent[]) => {
            // TODO: remove relay managers who are not staked
            // if (event.event === 'RelayRemoved') {
            //   foundRelays.delete(event.returnValues.relay)
            // } else {
            
            const genericEvent = eventList.find(event => event.args);
            if(!genericEvent){
                log.info('No event with suitable args found');

                return;
            }

            const { args: { relayManager } } = genericEvent;

            if(!genericEvent){
                log.info('No relayManager found in event');

                return;
            }
                
            foundRelayManagers.add(relayManager);
        });

        log.info(
            `fetchRelaysAdded: found unique relays: ${JSON.stringify(
                Array.from(foundRelayManagers.values())
            )}`
        );
        this.latestScannedBlock = toBlock;

        return foundRelayManagers;
    }

    _refreshFailures(): void {
        const newMap = new Map<string, RelayFailureInfo[]>();
        this.relayFailures.forEach((value: RelayFailureInfo[], key: string) => {
            newMap.set(
                key,
                value.filter((failure) => {
                    const elapsed =
                        (new Date().getTime() - failure.lastErrorTime) / 1000;
                        
                    return elapsed < this.config.relayTimeoutGrace;
                })
            );
        });
        this.relayFailures = newMap;
    }

    async getRelaysSortedForTransaction(
        transactionDetails: EnvelopingTransactionDetails
    ): Promise<IRelayHub.RelayManagerDataStruct[][]> {
        const sortedRelays: IRelayHub.RelayManagerDataStruct[][] = [];
        sortedRelays[0] = Array.from(this.preferredRelayers);
        sortedRelays[1] = await this._sortRelaysInternal(
            transactionDetails,
            this.allRelayers
        );

        return sortedRelays;
    }

    async _sortRelaysInternal(
        transactionDetails: EnvelopingTransactionDetails,
        activeRelays: IRelayHub.RelayManagerDataStruct[]
    ): Promise<IRelayHub.RelayManagerDataStruct[]> {
        const scores = new Map<string, number>();
        for (const activeRelay of activeRelays) {
            let score = 0;
            score = await this.scoreCalculator(
                activeRelay,
                transactionDetails,
                this.relayFailures.get(await activeRelay.url) ?? []
            );
            scores.set(await activeRelay.manager, score);
        }

        const resolvedActiveRelays = await Promise.all(activeRelays.map(async (activeRelay) => {
            
            const { currentlyStaked, manager, registered, url } = activeRelay;

            return {
                currentlyStaked: await currentlyStaked,
                manager: await manager,
                registered: await registered,
                url: await url
            }
        }))
        
        return Array.from(resolvedActiveRelays.values()).sort((a, b) => {
            const aScore = scores.get(a.manager) ?? 0;
            const bScore = scores.get(b.manager) ?? 0;

            return bScore - aScore;
        });
    }

    saveRelayFailure(
        lastErrorTime: number,
        relayManager: string,
        relayUrl: string
    ): void {
        const relayFailures = this.relayFailures.get(relayUrl);
        const newFailureInfo = {
            lastErrorTime,
            relayManager,
            relayUrl
        };
        if (!relayFailures) {
            this.relayFailures.set(relayUrl, [newFailureInfo]);
        } else {
            relayFailures.push(newFailureInfo);
        }
    }
}