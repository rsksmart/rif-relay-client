import { ContractInteractor, EnvelopingConfig, EnvelopingTransactionDetails, RelayData } from '@rsksmart/rif-relay-common';
import { RelayFailureInfo } from './types/RelayFailureInfo';
import { Address, AsyncScoreCalculator, RelayFilter } from './types/Aliases';
import { EventData } from 'web3-eth-contract';
export declare const EmptyFilter: RelayFilter;
/**
 * Basic score is reversed higher is better.
 * Relays that failed to respond recently will be downgraded for some period of time.
 */
export declare const DefaultRelayScore: (relay: RelayData, txDetails: EnvelopingTransactionDetails, failures: RelayFailureInfo[]) => Promise<number>;
export declare class KnownRelaysManager {
    private readonly contractInteractor;
    private readonly config;
    private readonly relayFilter;
    private readonly scoreCalculator;
    private latestScannedBlock;
    private relayFailures;
    relayLookupWindowParts: number;
    preferredRelayers: RelayData[];
    allRelayers: RelayData[];
    constructor(contractInteractor: ContractInteractor, config: EnvelopingConfig, relayFilter?: RelayFilter, scoreCalculator?: AsyncScoreCalculator);
    refresh(): Promise<void>;
    getRelayDataForManagers(relayManagers: Set<Address>): Promise<RelayData[]>;
    splitRange(fromBlock: number, toBlock: number, splits: number): Array<{
        fromBlock: number;
        toBlock: number;
    }>;
    getPastEventsForHub(fromBlock: number, toBlock: number): Promise<EventData[]>;
    _fetchRecentlyActiveRelayManagers(): Promise<Set<Address>>;
    _refreshFailures(): void;
    getRelaysSortedForTransaction(transactionDetails: EnvelopingTransactionDetails): Promise<RelayData[][]>;
    _sortRelaysInternal(transactionDetails: EnvelopingTransactionDetails, activeRelays: RelayData[]): Promise<RelayData[]>;
    saveRelayFailure(lastErrorTime: number, relayManager: Address, relayUrl: string): void;
}
