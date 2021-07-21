import { EnvelopingTransactionDetails, EnvelopingConfig, ContractInteractor } from '@rsksmart/rif-relay-common';
import { RelayFailureInfo } from './types/RelayFailureInfo';
import { Address, AsyncScoreCalculator, RelayFilter } from './types/Aliases';
import { RelayInfoUrl, RelayRegisteredEventInfo } from './types/RelayRegisteredEventInfo';
import { EventData } from 'web3-eth-contract';
export declare const EmptyFilter: RelayFilter;
/**
 * Basic score is reversed higher is better.
 * Relays that failed to respond recently will be downgraded for some period of time.
 */
export declare const DefaultRelayScore: (relay: RelayRegisteredEventInfo, txDetails: EnvelopingTransactionDetails, failures: RelayFailureInfo[]) => Promise<number>;
export declare class KnownRelaysManager {
    private readonly contractInteractor;
    private readonly config;
    private readonly relayFilter;
    private readonly scoreCalculator;
    private latestScannedBlock;
    private relayFailures;
    relayLookupWindowParts: number;
    preferredRelayers: RelayInfoUrl[];
    allRelayers: RelayInfoUrl[];
    constructor(contractInteractor: ContractInteractor, config: EnvelopingConfig, relayFilter?: RelayFilter, scoreCalculator?: AsyncScoreCalculator);
    refresh(): Promise<void>;
    getRelayInfoForManagers(relayManagers: Set<Address>): Promise<RelayRegisteredEventInfo[]>;
    splitRange(fromBlock: number, toBlock: number, splits: number): Array<{
        fromBlock: number;
        toBlock: number;
    }>;
    getPastEventsForHub(fromBlock: number, toBlock: number): Promise<EventData[]>;
    _fetchRecentlyActiveRelayManagers(): Promise<Set<Address>>;
    _refreshFailures(): void;
    getRelaysSortedForTransaction(transactionDetails: EnvelopingTransactionDetails): Promise<RelayInfoUrl[][]>;
    _sortRelaysInternal(transactionDetails: EnvelopingTransactionDetails, activeRelays: RelayInfoUrl[]): Promise<RelayInfoUrl[]>;
    saveRelayFailure(lastErrorTime: number, relayManager: Address, relayUrl: string): void;
}
