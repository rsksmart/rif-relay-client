import log from 'loglevel';
import { PrefixedHexString } from 'ethereumjs-tx';
import {
    PingResponse,
    DeployTransactionRequest,
    RelayTransactionRequest,
    EnvelopingConfig
} from '@rsksmart/rif-relay-common';
import HttpWrapper from './HttpWrapper';
import { RelayEstimation } from './RelayClient';

export default class HttpClient {
    private readonly httpWrapper: HttpWrapper;
    private readonly config: Partial<EnvelopingConfig>;

    constructor(httpWrapper: HttpWrapper, config: Partial<EnvelopingConfig>) {
        this.httpWrapper = httpWrapper;
        this.config = config;
    }

    async getPingResponse(
        relayUrl: string,
        verifier?: string
    ): Promise<PingResponse> {
        const verifierSuffix = verifier == null ? '' : '?verifier=' + verifier;
        const pingResponse = (await this.httpWrapper.sendPromise(
            relayUrl + '/getaddr' + verifierSuffix
        )) as PingResponse;
        if (pingResponse == null) {
            throw new Error('Relay responded without a body');
        }
        log.info(`pingResponse: ${JSON.stringify(pingResponse)}`);

        return pingResponse;
    }

    async relayTransaction(
        relayUrl: string,
        request: RelayTransactionRequest | DeployTransactionRequest
    ): Promise<PrefixedHexString> {
        const { signedTx, error } = (await this.httpWrapper.sendPromise(
            relayUrl + '/relay',
            request
        )) as { signedTx: string; error: string };
        log.info('relayTransaction response:', signedTx, error);
        if (error != null) {
            throw new Error(`Got error response from relay: ${error}`);
        }
        if (signedTx == null) {
            throw new Error('body.signedTx field missing.');
        }
        return signedTx;
    }

    async estimateMaxPossibleGas(
        relayUrl: string,
        request: RelayTransactionRequest | DeployTransactionRequest
    ): Promise<RelayEstimation> {
        const response = (await this.httpWrapper.sendPromise(
            relayUrl + '/estimate',
            request
        )) as RelayEstimation | { error: string };
        log.info('esimation relayTransaction response:', response);
        if ('error' in response) {
            throw Error(
                `Got error response from estimate relay: ${response.error}`
            );
        }
        return response;
    }
}
