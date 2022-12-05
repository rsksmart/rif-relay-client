import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
    constants,
    DeployTransactionRequest,
    EnvelopingConfig,
    RelayMetadata,
    RelayTransactionRequest
} from '@rsksmart/rif-relay-common';
import { DeployRequest, RelayRequest } from '@rsksmart/rif-relay-contracts';
import { createStubInstance, SinonStubbedInstance } from 'sinon';
import { HttpClient, HttpWrapper, RelayEstimation } from '../src';
import { createRandomAddress, createRandomeValue } from './utils';

use(chaiAsPromised);

const GAS_PRICE_PERCENT = 0; //
const MAX_RELAY_NONCE_GAP = 3;
const DEFAULT_RELAY_TIMEOUT_GRACE_SEC = 1800;
const DEFAULT_LOOKUP_WINDOW_BLOCKS = 60000;
const DEFAULT_CHAIN_ID = 33;

describe('HttpClient', function () {
    const deployRequest: DeployRequest = {
        request: {
            data: '',
            from: createRandomAddress(),
            nonce: createRandomeValue(1e16),
            relayHub: createRandomAddress(),
            to: createRandomAddress(),
            tokenAmount: createRandomeValue(1e16),
            tokenContract: createRandomAddress(),
            tokenGas: createRandomeValue(1000),
            value: createRandomeValue(1e16),
            index: createRandomeValue(100),
            recoverer: createRandomAddress(),
            validUntilTime: '0'
        },
        relayData: {
            gasPrice: createRandomeValue(1000),
            callForwarder: createRandomAddress(),
            callVerifier: createRandomAddress(),
            feesReceiver: createRandomAddress()
        }
    };
    const relayRequest: RelayRequest = {
        request: {
            data: '',
            from: createRandomAddress(),
            nonce: createRandomeValue(1e16),
            relayHub: createRandomAddress(),
            to: createRandomAddress(),
            tokenAmount: createRandomeValue(1e16),
            tokenContract: createRandomAddress(),
            tokenGas: createRandomeValue(1000),
            value: createRandomeValue(1e16),
            gas: createRandomeValue(1000),
            validUntilTime: '0'
        },
        relayData: {
            gasPrice: createRandomeValue(1000),
            callForwarder: createRandomAddress(),
            callVerifier: createRandomAddress(),
            feesReceiver: createRandomAddress()
        }
    };
    const defaultConfig: EnvelopingConfig = {
        preferredRelays: [],
        onlyPreferredRelays: false,
        relayLookupWindowParts: 1,
        relayLookupWindowBlocks: DEFAULT_LOOKUP_WINDOW_BLOCKS,
        gasPriceFactorPercent: GAS_PRICE_PERCENT,
        minGasPrice: 60000000, // 0.06 GWei
        maxRelayNonceGap: MAX_RELAY_NONCE_GAP,
        sliceSize: 3,
        relayTimeoutGrace: DEFAULT_RELAY_TIMEOUT_GRACE_SEC,
        methodSuffix: '',
        jsonStringifyRequest: false,
        chainId: DEFAULT_CHAIN_ID,
        relayHubAddress: constants.ZERO_ADDRESS,
        deployVerifierAddress: constants.ZERO_ADDRESS,
        relayVerifierAddress: constants.ZERO_ADDRESS,
        forwarderAddress: constants.ZERO_ADDRESS,
        smartWalletFactoryAddress: constants.ZERO_ADDRESS,
        logLevel: 0,
        clientId: '1'
    };
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
            const metadata: RelayMetadata = {
                signature: '0x1',
                relayHubAddress: relayRequest.request.relayHub,
                relayMaxNonce: Number(createRandomeValue(100))
            };
            const request: RelayTransactionRequest = {
                relayRequest: relayRequest,
                metadata: metadata
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
            const metadata: RelayMetadata = {
                signature: '0x1',
                relayHubAddress: relayRequest.request.relayHub,
                relayMaxNonce: Number(createRandomeValue(100))
            };
            const request: RelayTransactionRequest = {
                relayRequest: relayRequest,
                metadata: metadata
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
            const metadata: RelayMetadata = {
                signature: '0x1',
                relayHubAddress: deployRequest.request.relayHub,
                relayMaxNonce: Number(createRandomeValue(100))
            };
            const request: DeployTransactionRequest = {
                relayRequest: deployRequest,
                metadata: metadata
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
            const metadata: RelayMetadata = {
                signature: '0x1',
                relayHubAddress: deployRequest.request.relayHub,
                relayMaxNonce: Number(createRandomeValue(100))
            };
            const request: DeployTransactionRequest = {
                relayRequest: deployRequest,
                metadata: metadata
            };

            httpWrapper.sendPromise.throwsException(error);
            const estimation = httpClient.estimateMaxPossibleGas(url, request);
            await expect(estimation).to.be.rejectedWith(error);
        });
    });
});
