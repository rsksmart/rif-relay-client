import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
    DeployTransactionRequest,
    EnvelopingConfig,
    RelayMetadata,
    RelayTransactionRequest
} from '@rsksmart/rif-relay-common';
import {
    DeployRequest,
    DeployRequestStruct,
    ForwardRequest,
    RelayData,
    RelayRequest
} from '@rsksmart/rif-relay-contracts';
import { createStubInstance, SinonStubbedInstance } from 'sinon';
import { HttpClient, HttpWrapper, RelayEstimation } from '../src';

use(chaiAsPromised);

describe('HttpClient', function () {
    const deployRequest: DeployRequest = {
        request: {
            index: '0'
        } as DeployRequestStruct,
        relayData: {
            gasPrice: '60000000'
        } as RelayData
    };
    const relayRequest: RelayRequest = {
        request: {
            gas: '100'
        } as ForwardRequest,
        relayData: {
            gasPrice: '60000000'
        } as RelayData
    };
    const defaultConfig = {} as EnvelopingConfig;
    let httpClient: HttpClient;
    let httpWrapper: SinonStubbedInstance<HttpWrapper>;
    const url = 'server_url';

    describe('estimateMaxPossibleGas', function () {
        beforeEach(function () {
            httpWrapper = createStubInstance(HttpWrapper);
            httpClient = new HttpClient(httpWrapper, defaultConfig);
        });

        it('should estimate max possible gas for a relay transaction with signature', async function () {
            const response: RelayEstimation = {
                estimation: '128954',
                exchangeRate: '0.00000332344907316948',
                gasPrice: '60000000',
                requiredTokenAmount: '2328075390853277499',
                requiredNativeAmount: '7737240000000'
            };
            const metadata: Partial<RelayMetadata> = {
                signature: '0x1'
            };
            const request: RelayTransactionRequest = {
                relayRequest: relayRequest as RelayRequest,
                metadata: metadata as RelayMetadata
            };
            httpWrapper.sendPromise.returns(Promise.resolve(response));
            const estimation = await httpClient.estimateMaxPossibleGas(
                url,
                request
            );
            expect(estimation).to.be.equal(response);
        });

        it('should estimate max possible gas for a relay transaction without signature', async function () {
            const response: RelayEstimation = {
                estimation: '125583',
                exchangeRate: '0.00000332344907316948',
                gasPrice: '60000000',
                requiredTokenAmount: '2267216928591025855',
                requiredNativeAmount: '7534980000000'
            };
            const metadata: Partial<RelayMetadata> = {
                signature: '0x0'
            };
            const request: RelayTransactionRequest = {
                relayRequest: relayRequest as RelayRequest,
                metadata: metadata as RelayMetadata
            };
            httpWrapper.sendPromise.returns(Promise.resolve(response));
            const estimation = await httpClient.estimateMaxPossibleGas(
                url,
                request
            );
            expect(estimation).to.be.equal(response);
        });

        it('should estimate max possible gas for a deploy transaction with signature', async function () {
            const response: RelayEstimation = {
                estimation: '193889',
                exchangeRate: '0.00000332344907316948',
                gasPrice: '60000000',
                requiredTokenAmount: '3500381604736193689',
                requiredNativeAmount: '11633340000000'
            };
            const metadata: Partial<RelayMetadata> = {
                signature: '0x1'
            };
            const request: DeployTransactionRequest = {
                relayRequest: deployRequest as DeployRequest,
                metadata: metadata as RelayMetadata
            };
            httpWrapper.sendPromise.returns(Promise.resolve(response));
            const estimation = await httpClient.estimateMaxPossibleGas(
                url,
                request
            );
            expect(estimation).to.be.equal(response);
        });

        it('should estimate max possible gas for a deploy transaction without signature', async function () {
            const error = new Error(
                'LinearFit estimation not implemented for deployments'
            );
            const metadata: Partial<RelayMetadata> = {
                signature: '0x1'
            };
            const request: DeployTransactionRequest = {
                relayRequest: deployRequest as DeployRequest,
                metadata: metadata as RelayMetadata
            };

            httpWrapper.sendPromise.throwsException(error);
            const estimation = httpClient.estimateMaxPossibleGas(url, request);
            await expect(estimation).to.be.rejectedWith(error);
        });
    });
});
