import { PrefixedHexString } from 'ethereumjs-tx';
import { EnvelopingTransactionDetails, PingResponse, RelayManagerData, RelayRequest } from '@rsksmart/rif-relay-common';
import { RelayFailureInfo } from './RelayFailureInfo';
export declare type Address = string;
export declare type IntString = string;
export declare type BoolString = string;
/**
 * For legacy reasons, to filter out the relay this filter has to throw.
 * TODO: make ping filtering sane!
 */
export declare type PingFilter = (pingResponse: PingResponse, transactionDetails: EnvelopingTransactionDetails) => void;
export declare type AsyncDataCallback = (relayRequest: RelayRequest) => Promise<PrefixedHexString>;
export declare type RelayFilter = (relayData: RelayManagerData) => boolean;
export declare type AsyncScoreCalculator = (relay: RelayManagerData, txDetails: EnvelopingTransactionDetails, failures: RelayFailureInfo[]) => Promise<number>;
export declare function notNull<TValue>(value: TValue | null | undefined): value is TValue;
