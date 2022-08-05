import {
    createStubInstance,
    SinonStubbedInstance,
    replace,
    fake,
    spy
} from 'sinon';
import { stubInterface } from 'ts-sinon';
import { expect, use, assert } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import {
    constants,
    ContractInteractor,
    EnvelopingConfig,
    EnvelopingTransactionDetails
} from '@rsksmart/rif-relay-common';
import {
    AccountManager,
    RelayClient,
    EnvelopingDependencies,
    HttpClient,
    HttpWrapper,
    EmptyFilter,
    GasPricePingFilter,
    RelayedTransactionValidator,
    DefaultRelayScore,
    KnownRelaysManager
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
    const fakeDefaultConfig: EnvelopingConfig = {
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
    let fakeContractInteractor: SinonStubbedInstance<ContractInteractor>;
    let fakeAccountManager: SinonStubbedInstance<AccountManager>;
    let mockDependencies: EnvelopingDependencies;
    const fakeTransactionDetails: EnvelopingTransactionDetails = {
        from: 'fake_address1',
        to: constants.ZERO_ADDRESS,
        callForwarder: 'fake_address2',
        data: '0x'
    };
    let relayClient: RelayClient;
    let mockHttpProvider: HttpProvider;

    before(() => {
        fakeContractInteractor = createStubInstance(ContractInteractor, {
            getSenderNonce: Promise.resolve('fake_nonce'),
            verifyForwarder: Promise.resolve(undefined)
        });
        fakeAccountManager = createStubInstance(AccountManager, {
            sign: Promise.resolve('fake_signature')
        });
        mockDependencies = {
            httpClient: new HttpClient(new HttpWrapper(), fakeDefaultConfig),
            contractInteractor: fakeContractInteractor,
            knownRelaysManager: new KnownRelaysManager(
                fakeContractInteractor,
                fakeDefaultConfig,
                EmptyFilter
            ),
            accountManager: fakeAccountManager,
            transactionValidator: new RelayedTransactionValidator(
                fakeContractInteractor,
                fakeDefaultConfig
            ),
            pingFilter: GasPricePingFilter,
            relayFilter: EmptyFilter,
            scoreCalculator: DefaultRelayScore,
            config: fakeDefaultConfig
        };
        replace(
            configurator,
            'getDependencies',
            fake.returns(mockDependencies)
        );
        mockHttpProvider = stubInterface<HttpProvider>();
        relayClient = new RelayClient(mockHttpProvider, fakeDefaultConfig);
    });

    describe('validateSmartWallet', () => {
        it('should use verifyForwarder', async () => {
            const spyCall = spy(relayClient, 'resolveForwarder');
            await relayClient.validateSmartWallet(fakeTransactionDetails);
            assert.isTrue(
                spyCall.calledOnceWithExactly(fakeTransactionDetails),
                'Was not called once'
            );
            expect(fakeContractInteractor.verifyForwarder).to.have.been
                .calledOnce;
        });

        it('should fail if tansactionDetails is null', async () => {
            await assert.isRejected(
                relayClient.validateSmartWallet(null),
                "Cannot read properties of null (reading 'callForwarder')"
            );
        });
    });
});
