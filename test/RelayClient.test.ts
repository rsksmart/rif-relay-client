import {
    createStubInstance,
    SinonStubbedInstance,
    replace,
    fake,
    spy,
    restore
} from 'sinon';
import { stubInterface } from 'ts-sinon';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import {
    constants,
    ContractInteractor,
    EnvelopingConfig,
    EnvelopingTransactionDetails,
    PingResponse
} from '@rsksmart/rif-relay-common';
import {
    AccountManager,
    RelayClient,
    EnvelopingDependencies,
    HttpClient,
    EmptyFilter,
    GasPricePingFilter,
    RelayedTransactionValidator,
    DefaultRelayScore,
    KnownRelaysManager,
    RelayEstimation
} from '../src';
import { HttpProvider } from 'web3-core';
import * as configurator from '../src/Configurator';

use(sinonChai);
use(chaiAsPromised);

const GAS_PRICE_PERCENT = 0; //
const MAX_RELAY_NONCE_GAP = 3;
const DEFAULT_RELAY_TIMEOUT_GRACE_SEC = 1800;
const DEFAULT_LOOKUP_WINDOW_BLOCKS = 60000;
const DEFAULT_CHAIN_ID = 33;

describe('RelayClient', () => {
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
    let contractInteractor: SinonStubbedInstance<ContractInteractor>;
    let accountManager: SinonStubbedInstance<AccountManager>;
    let httpClient: SinonStubbedInstance<HttpClient>;
    let mockDependencies: EnvelopingDependencies;
    let relayClient: RelayClient;
    let mockHttpProvider: HttpProvider;

    describe('validateSmartWallet', () => {
        beforeEach(function () {
            contractInteractor = createStubInstance(ContractInteractor, {
                getSenderNonce: Promise.resolve('fake_nonce'),
                verifyForwarder: Promise.resolve(undefined)
            });
            accountManager = createStubInstance(AccountManager, {
                sign: Promise.resolve('fake_signature')
            });
            mockDependencies = {
                httpClient: createStubInstance(HttpClient),
                contractInteractor: contractInteractor,
                knownRelaysManager: new KnownRelaysManager(
                    contractInteractor,
                    defaultConfig,
                    EmptyFilter
                ),
                accountManager: accountManager,
                transactionValidator: new RelayedTransactionValidator(
                    contractInteractor,
                    defaultConfig
                ),
                pingFilter: GasPricePingFilter,
                relayFilter: EmptyFilter,
                scoreCalculator: DefaultRelayScore,
                config: defaultConfig
            };
            replace(
                configurator,
                'getDependencies',
                fake.returns(mockDependencies)
            );
            mockHttpProvider = stubInterface<HttpProvider>();
            relayClient = new RelayClient(mockHttpProvider, defaultConfig);
        });

        afterEach(function () {
            restore();
        });

        const fakeTransactionDetails: EnvelopingTransactionDetails = {
            from: 'fake_address1',
            to: constants.ZERO_ADDRESS,
            callForwarder: 'fake_address2',
            data: '0x'
        };

        it('should use verifyForwarder', async () => {
            const spyCall = spy(relayClient, 'resolveForwarder');
            await relayClient.validateSmartWallet(fakeTransactionDetails);
            expect(
                spyCall.calledOnceWithExactly(fakeTransactionDetails),
                'Was not called once'
            ).to.be.true;
            expect(contractInteractor.verifyForwarder).to.have.been.calledOnce;
        });

        it('should fail if EOA is not the owner', async () => {
            const error = new TypeError(
                'VM Exception while processing transaction: revert Not the owner of the SmartWallet'
            );
            contractInteractor.verifyForwarder.throws(error);
            await expect(
                relayClient.validateSmartWallet(fakeTransactionDetails)
            ).to.be.rejectedWith(error.message);
        });

        it('should fail if nonce mismatch', async () => {
            const error = new TypeError(
                'VM Exception while processing transaction: revert nonce mismatch'
            );
            contractInteractor.verifyForwarder.throws(error);
            await expect(
                relayClient.validateSmartWallet(fakeTransactionDetails)
            ).to.be.rejectedWith(error.message);
        });

        it('should fail if signature mismatch', async () => {
            const error = new TypeError(
                'VM Exception while processing transaction: revert Signature mismatch'
            );
            contractInteractor.verifyForwarder.throws(error);
            await expect(
                relayClient.validateSmartWallet(fakeTransactionDetails)
            ).to.be.rejectedWith(error.message);
        });
    });

    describe('estimateMaxPossibleGas', function () {
        const pingResponse = {
            feesReceiver: '0x3'
        } as PingResponse;

        beforeEach(function () {
            httpClient = createStubInstance(HttpClient, {
                getPingResponse: Promise.resolve(pingResponse)
            });
            contractInteractor = createStubInstance(ContractInteractor);
            accountManager = createStubInstance(AccountManager);
            mockDependencies = {
                httpClient,
                contractInteractor,
                knownRelaysManager: new KnownRelaysManager(
                    contractInteractor,
                    defaultConfig,
                    EmptyFilter
                ),
                accountManager,
                transactionValidator: new RelayedTransactionValidator(
                    contractInteractor,
                    defaultConfig
                ),
                pingFilter: GasPricePingFilter,
                relayFilter: EmptyFilter,
                scoreCalculator: DefaultRelayScore,
                config: defaultConfig
            };
            replace(
                configurator,
                'getDependencies',
                fake.returns(mockDependencies)
            );
            mockHttpProvider = stubInterface<HttpProvider>();
            relayClient = new RelayClient(mockHttpProvider, defaultConfig);
            replace(
                relayClient,
                'getInternalCallCost',
                fake.returns(Promise.resolve(5))
            );
        });

        afterEach(function () {
            restore();
        });

        it('should estimate max possible gas for a relay transaction with signature', async function () {
            const response: RelayEstimation = {
                estimation: '128954',
                exchangeRate: '0.00000332344907316948',
                gasPrice: '60000000',
                requiredTokenAmount: '2328075390853277499',
                requiredNativeAmount: '7737240000000'
            };
            httpClient.estimateMaxPossibleGas.returns(
                Promise.resolve(response)
            );
            const transactionDetails: EnvelopingTransactionDetails = {
                from: '0x1',
                to: constants.ZERO_ADDRESS,
                value: '0',
                callForwarder: '0x2',
                data: '0x0'
            };
            const estimation = await relayClient.estimateMaxPossibleGas(
                transactionDetails,
                true
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
            httpClient.estimateMaxPossibleGas.returns(
                Promise.resolve(response)
            );
            const transactionDetails: EnvelopingTransactionDetails = {
                from: '0x1',
                to: constants.ZERO_ADDRESS,
                value: '0',
                callForwarder: '0x2',
                data: '0x0',
                index: '1'
            };
            const estimation = await relayClient.estimateMaxPossibleGas(
                transactionDetails,
                false
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
            httpClient.estimateMaxPossibleGas.returns(
                Promise.resolve(response)
            );
            const transactionDetails: EnvelopingTransactionDetails = {
                from: '0x1',
                to: constants.ZERO_ADDRESS,
                value: '0',
                callForwarder: '0x2',
                data: '0x0',
                recoverer: constants.ZERO_ADDRESS,
                index: '1'
            };
            const estimation = await relayClient.estimateMaxPossibleGas(
                transactionDetails,
                true
            );
            expect(estimation).to.be.equal(response);
        });

        it('should estimate max possible gas for a deploy transaction without signature', async function () {
            const error = new Error(
                'LinearFit estimation not implemented for deployments'
            );
            httpClient.estimateMaxPossibleGas.throwsException(error);
            const transactionDetails: EnvelopingTransactionDetails = {
                from: '0x1',
                to: constants.ZERO_ADDRESS,
                value: '0',
                callForwarder: '0x2',
                data: '0x0',
                recoverer: constants.ZERO_ADDRESS,
                index: '1'
            };
            const estimation = relayClient.estimateMaxPossibleGas(
                transactionDetails,
                false
            );
            await expect(estimation).to.be.rejectedWith(error);
        });
    });
});
