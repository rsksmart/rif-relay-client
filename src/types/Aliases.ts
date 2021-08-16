import { PrefixedHexString } from 'ethereumjs-tx';
import {
    EnvelopingTransactionDetails,
    PingResponse,
    RelayData,
    RelayRequest
} from '@rsksmart/rif-relay-common';
import { RelayFailureInfo } from './RelayFailureInfo';

export type Address = string;
export type IntString = string;
export type BoolString = string;
/**
 * For legacy reasons, to filter out the relay this filter has to throw.
 * TODO: make ping filtering sane!
 */
export type PingFilter = (
    pingResponse: PingResponse,
    transactionDetails: EnvelopingTransactionDetails
) => void;
export type AsyncDataCallback = (
    relayRequest: RelayRequest
) => Promise<PrefixedHexString>;

export type RelayFilter = (relayData: RelayData) => boolean;
export type AsyncScoreCalculator = (
    relay: RelayData,
    txDetails: EnvelopingTransactionDetails,
    failures: RelayFailureInfo[]
) => Promise<number>;

export function notNull<TValue>(
    value: TValue | null | undefined
): value is TValue {
    return value !== null && value !== undefined;
}
