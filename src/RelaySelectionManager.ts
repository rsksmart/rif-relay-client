import log from 'loglevel';
import type KnownRelaysManager from './KnownRelaysManager';
import type HttpClient from './api/common/HttpClient';
import type { PingFilter } from './utils';
import type{
    EnvelopingConfig,
    EnvelopingTransactionDetails,
    // replaceErrors
} from '@rsksmart/rif-relay-common';
import type { RelayManagerData }  from './utils';
import type { PartialRelayInfo, RelayInfo } from './utils';

export interface RaceResult {
    winner?: PartialRelayInfo;
    errors: Map<string, Error>;
}

export default class RelaySelectionManager {
    private readonly knownRelaysManager: KnownRelaysManager;

    private readonly httpClient: HttpClient;

    private readonly config: EnvelopingConfig;

    private readonly pingFilter: PingFilter;

    private readonly transactionDetails: EnvelopingTransactionDetails;

    private remainingRelays: RelayManagerData[][] = [];

    private isInitialized = false;

    public errors: Map<string, Error> = new Map<string, Error>();

    constructor(
        transactionDetails: EnvelopingTransactionDetails,
        knownRelaysManager: KnownRelaysManager,
        httpClient: HttpClient,
        pingFilter: PingFilter,
        config: EnvelopingConfig
    ) {
        this.transactionDetails = transactionDetails;
        this.knownRelaysManager = knownRelaysManager;
        this.httpClient = httpClient;
        this.pingFilter = pingFilter;
        this.config = config;
    }

    /**
     * Ping those relays that were not pinged yet, and remove both the returned relay or relays re from {@link remainingRelays}
     * @returns the first relay to respond to a ping message. Note: will never return the same relay twice.
     */
    async selectNextRelay(): Promise<RelayInfo | undefined | void> {
        if (this.transactionDetails.onlyPreferredRelays ?? false) {
            log.info('Only using preferred relays');
            let index = 0;
            const running = true;

            while (running) {
                let relayInfo: RelayInfo | undefined | void;
                const slice = this._getPreferredRelaysNextSlice(index);

                if (slice.length > 0) {
                    relayInfo = await this._nextRelayInternal(slice);

                    if (relayInfo == null) {
                        index += slice.length;
                        continue;
                    }
                }

                return relayInfo;
            }
        } else {
            const running = true;

            while (running) {
                const slice = this._getNextSlice();
                let relayInfo: RelayInfo | undefined | void;

                if (slice.length > 0) {
                    relayInfo = await this._nextRelayInternal(slice);

                    if (relayInfo == null) {
                        continue;
                    }
                }

                return relayInfo;
            }
        }
    }

    _getPreferredRelaysNextSlice(index: number)/*: RelayManagerData[]*/ {
        if (!this.isInitialized) {
            throw new Error('init() not called');
        }

        let slice: RelayManagerData[] = [];
        const row = this.remainingRelays[0];

        if (row && row.length >= index + 1) {
            const relays = row.slice(
                index,
                row.length
            );

            const bulkSize = Math.min(this.config.sliceSize, relays.length);
            slice = relays.slice(0, bulkSize);
        }

        return slice;
    }

    async _nextRelayInternal(
        relays: RelayManagerData[]
    ): Promise<RelayInfo | undefined | void>  {
        log.info(
            'nextRelay: find fastest relay from: ' + JSON.stringify(relays)
        );
        const raceResult = await this._raceToSuccess(relays);
        // log.info(
        //     `race finished with a result: ${JSON.stringify(
        //         raceResult,
        //         replaceErrors
        //     )}`
        // );
        this._handleRaceResults(raceResult);
        if (raceResult.winner != null) {
            const managerAddress =
                raceResult.winner.pingResponse.relayManagerAddress;
            log.info(
                `finding relay register info for manager address: ${managerAddress}; known info: ${JSON.stringify(
                    raceResult.winner.relayInfo
                )}`
            );
            const activeRelays =
                await this.knownRelaysManager.getRelayDataForManagers(
                    new Set([managerAddress])
                );
            if (activeRelays.length == 1 && activeRelays[0]) {
                return {
                    pingResponse: raceResult.winner.pingResponse,
                    relayInfo: activeRelays[0] as RelayManagerData
                };
            } else {
                throw new Error(
                    `unexpected amount of active relays for manager address: ${managerAddress}`
                );
            }
        } else {
            log.info(
                `no race winner found for relays: ${JSON.stringify(relays)})`
            );
        }
    }

    async init(): Promise<this> {
        this.remainingRelays =
            await this.knownRelaysManager.getRelaysSortedForTransaction(
                this.transactionDetails
            ) as RelayManagerData[][];
        this.isInitialized = true;

        return this;
    }

    // relays left to try
    // (note that some edge-cases (like duplicate urls) are not filtered out)
    relaysLeft(): RelayManagerData[] {
        return this.remainingRelays.flatMap((list) => list);
    }

    _getNextSlice(): RelayManagerData[] {
        if (!this.isInitialized) {
            throw new Error('init() not called');
        }
        for (const relays of this.remainingRelays) {
            const bulkSize = Math.min(this.config.sliceSize, relays.length);
            const slice = relays.slice(0, bulkSize);
            if (slice.length === 0) {
                continue;
            }
            
            return slice;
        }

        return [];
    }

    /**
     * @returns JSON response from the relay server, but adds the requested URL to it :'-(
     */
    async _getRelayAddressPing(
        relayInfo: RelayManagerData
    ): Promise<PartialRelayInfo> {
        log.info(`getRelayAddressPing URL: ${relayInfo.url}`);

        const pingResponse = await this.httpClient.getPingResponse(
            relayInfo.url,
            this.transactionDetails.callVerifier
        );

        if (!pingResponse.ready) {
            throw new Error(`Relay not ready ${JSON.stringify(pingResponse)}`);
        }
        
        this.pingFilter(pingResponse, this.transactionDetails);

        return {
            pingResponse,
            relayInfo
        };
    }

    /**
     * From https://stackoverflow.com/a/37235207 (added types, modified to catch exceptions)
     * Accepts an array of promises.
     * Resolves once any promise resolves, ignores the rest. Exceptions returned separately.
     */
    async _raceToSuccess(relays: RelayManagerData[]): Promise<RaceResult> {
        const errors: Map<string, Error> = new Map<string, Error>();

        return await new Promise((resolve) => {
            relays.forEach((relay: RelayManagerData) => {
                this._getRelayAddressPing(relay)
                    .then((winner: PartialRelayInfo) => {
                        resolve({
                            winner,
                            errors
                        });
                    })
                    .catch((err: Error) => {
                        errors.set(relay.url, err);
                        if (errors.size === relays.length) {
                            resolve({ errors });
                        }
                    });
            });
        });
    }

    _handleRaceResults(raceResult: RaceResult): void {
        if (!this.isInitialized) {
            throw new Error('init() not called');
        }
        this.errors = new Map([...this.errors, ...raceResult.errors]);
        this.remainingRelays = this.remainingRelays.map((relays) =>
            relays
                .filter(
                    (relay) => relay.url !== raceResult.winner?.relayInfo.url
                )
                .filter(
                    (relay) =>
                        !Array.from(raceResult.errors.keys()).includes(
                            relay.url
                        )
                )
        );
    }
}