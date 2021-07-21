import { PrefixedHexString } from 'ethereumjs-tx';
import { PingResponse, RelayRequest, EnvelopingTransactionDetails } from '@rsksmart/rif-relay-common';
import { RelayFailureInfo } from './RelayFailureInfo';
import { RelayRegisteredEventInfo } from './RelayRegisteredEventInfo';
export declare type Address = string;
export declare type IntString = string;
export declare type BoolString = string;
/**
 * For legacy reasons, to filter out the relay this filter has to throw.
 * TODO: make ping filtering sane!
 */
export declare type PingFilter = (pingResponse: PingResponse, transactionDetails: EnvelopingTransactionDetails) => void;
export declare type AsyncDataCallback = (relayRequest: RelayRequest) => Promise<PrefixedHexString>;
export declare type RelayFilter = (registeredEventInfo: RelayRegisteredEventInfo) => boolean;
export declare type AsyncScoreCalculator = (relay: RelayRegisteredEventInfo, txDetails: EnvelopingTransactionDetails, failures: RelayFailureInfo[]) => Promise<number>;
export declare function notNull<TValue>(value: TValue | null | undefined): value is TValue;
