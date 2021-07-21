import { PrefixedHexString } from 'ethereumjs-tx';
import { PingResponse, DeployTransactionRequest, RelayTransactionRequest, EnvelopingConfig } from '@rsksmart/rif-relay-common';
import HttpWrapper from './HttpWrapper';
export default class HttpClient {
    private readonly httpWrapper;
    private readonly config;
    constructor(httpWrapper: HttpWrapper, config: Partial<EnvelopingConfig>);
    getPingResponse(relayUrl: string, verifier?: string): Promise<PingResponse>;
    relayTransaction(relayUrl: string, request: RelayTransactionRequest | DeployTransactionRequest): Promise<PrefixedHexString>;
}
