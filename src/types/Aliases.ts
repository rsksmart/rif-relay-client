import { PrefixedHexString } from 'ethereumjs-tx';
import {
    EnvelopingTransactionDetails,
    PingResponse,
    RelayRequest
} from '@rsksmart/rif-relay-common';
import { RelayManagerData } from '@rsksmart/rif-relay-contracts';
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

export type RelayFilter = (relayData: RelayManagerData) => boolean;
export type AsyncScoreCalculator = (
    relay: RelayManagerData,
    txDetails: EnvelopingTransactionDetails,
    failures: RelayFailureInfo[]
) => Promise<number>;

export function notNull<TValue>(
    value: TValue | null | undefined
): value is TValue {
    return value !== null && value !== undefined;
}
