import { PrefixedHexString } from 'ethereumjs-tx';
export interface TmpRelayTransactionJsonRequest {
    relayWorker: string;
    data: PrefixedHexString;
    signature: PrefixedHexString;
    from: string;
    to: string;
    value: string;
    callVerifier: string;
    clientId: string;
    callForwarder: string;
    gasPrice: string;
    gasLimit: string;
    senderNonce: string;
    relayMaxNonce: number;
    relayHubAddress: string;
}
