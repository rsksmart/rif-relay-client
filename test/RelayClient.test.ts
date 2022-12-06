import type { Network } from '@ethersproject/networks';
import {
  EnvelopingTypes,
  IForwarder,
  IForwarder__factory,
} from '@rsksmart/rif-relay-contracts';
import { BigNumber as BigNumberJs } from 'bignumber.js';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import {
  BigNumber,
  BigNumberish,
  constants,
  providers,
  Signer,
  utils,
  Wallet,
} from 'ethers';
import Sinon, { SinonStubbedInstance } from 'sinon';
import sinonChai from 'sinon-chai';
import type { EnvelopingConfig } from 'src/common/config.types';
import AccountManager from '../src/AccountManager';
import type { HubInfo } from '../src/common/relayHub.types';
import type {
  RelayRequest,
  RelayRequestBody,
  UserDefinedRelayData,
} from '../src/common/relayRequest.types';
import type { EnvelopingTxRequest } from '../src/common/relayTransaction.types';
import EnvelopingEventEmitter, {
  envelopingEvents,
} from '../src/events/EnvelopingEventEmitter';
import RelayClient from '../src/RelayClient';
import { FAKE_ENVELOPING_CONFIG } from './config.fakes';
import { FAKE_RELAY_REQUEST } from './request.fakes';

use(sinonChai);
use(chaiAsPromised);
const sandbox = Sinon.createSandbox();
const createRandomAddress = () => Wallet.createRandom().address;


const FAKE_TX_COUNT = 456;
const FAKE_CHAIN_ID = 33;
const FAKE_SIGNATURE = 'FAKE_SIGNATURE';

const createRandomAddress = () => Wallet.createRandom().address;

describe('RelayClient', function () {
  afterEach(function () {
    sandbox.restore();
  });

  describe('constructor', function () {
    it('should store provider', function () {
      const expectedProvider: providers.BaseProvider =
        sandbox.createStubInstance(providers.JsonRpcProvider);
      const relayClient = new RelayClient();

      (relayClient as unknown as { _provider: providers.Provider })._provider =
        expectedProvider;
      expect(relayClient).to.be.instanceOf(RelayClient);
      expect(
        (relayClient as unknown as { _provider: providers.Provider })._provider,
        'Provider'
      ).to.equal(expectedProvider);
    });
  });

  describe('getInternalGasEstimation', function () {
    let provider: SinonStubbedInstance<providers.BaseProvider>;
    let relayClient: RelayClient;
    let relayRequest: EnvelopingTypes.RelayRequestStruct;

    beforeEach(function () {
      relayRequest = {
        request: {
          from: createRandomAddress(),
          to: createRandomAddress(),
          data: '0x01',
        },
        relayData: {
          gasPrice: '60000000',
        },
      } as EnvelopingTypes.RelayRequestStruct;
      relayClient = new RelayClient();
      provider = sandbox.createStubInstance(providers.JsonRpcProvider);
      (relayClient as unknown as { _provider: providers.Provider })._provider =
        provider;
    });

    afterEach(function () {
      sandbox.restore();
    });

    it('should return the estimation applying the internal correction', async function () {
      const estimateGas = BigNumber.from(10000);
      provider.estimateGas.returns(Promise.resolve(estimateGas));
      const internalGasCorrection = 5000;
      const estimation = await relayClient.estimateInternalCallGas(
        relayRequest,
        internalGasCorrection
      );
      const expectedEstimation = estimateGas.sub(internalGasCorrection);
      expect(estimation.toString()).to.be.equal(expectedEstimation.toString());
    });

    it('should return the estimation without applying the internal correction', async function () {
      const estimateGas = BigNumber.from(4000);
      provider.estimateGas.returns(Promise.resolve(estimateGas));
      const internalGasCorrection = 5000;
      const estimation = await relayClient.estimateInternalCallGas(
        relayRequest,
        internalGasCorrection
      );
      const expectedEstimation = estimateGas;
      expect(estimation.toString()).to.be.equal(expectedEstimation.toString());
    });

    it('should return estimation without applying gas correction factor', async function () {
      const stubApplyGasCorrection = sandbox
        .stub(
          relayClient as unknown as {
            _applyGasCorrectionFactor: () => BigNumber;
          },
          '_applyGasCorrectionFactor'
        )
        .returns(BigNumber.from(7500));
      const estimateGas = BigNumber.from(10000);
      provider.estimateGas.returns(Promise.resolve(estimateGas));
      const internalGasCorrection = 5000;
      const estimation = await relayClient.estimateInternalCallGas(
        relayRequest,
        internalGasCorrection,
        false
      );
      const expectedEstimation = estimateGas.sub(internalGasCorrection);
      expect(estimation.toString()).to.be.equal(expectedEstimation.toString());
      expect(stubApplyGasCorrection.calledOnce).to.be.false;
    });

    it('should return estimation applying gas correction factor', async function () {
      const expectedEstimation = BigNumber.from(7500);
      const stubApplyGasCorrection = sandbox
        .stub(
          relayClient as unknown as {
            _applyGasCorrectionFactor: () => BigNumber;
          },
          '_applyGasCorrectionFactor'
        )
        .returns(expectedEstimation);
      const estimateGas = BigNumber.from(10000);
      provider.estimateGas.returns(Promise.resolve(estimateGas));
      const internalGasCorrection = 5000;
      const estimation = await relayClient.estimateInternalCallGas(
        relayRequest,
        internalGasCorrection
      );
      expect(estimation.toString()).to.be.equal(expectedEstimation.toString());
      expect(stubApplyGasCorrection.calledOnce).to.be.true;
    });
  });

  describe('_prepareRelayHttpRequest', function () {
    const originalConfig = { ...config };
    let relayClient: RelayClientExposed;
    let forwarderStub: Sinon.SinonStubbedInstance<IForwarder>;
    let connectForwarderFactoryStub: Sinon.SinonStub<
      [address: string, signerOrProvider: providers.Provider | Signer],
      IForwarder
    >;
    let accountManagerStub: SinonStubbedInstance<AccountManager>;

    type RelayClientExposed = {
      _provider: providers.Provider;
      _prepareRelayHttpRequest: (
        hubInfo: Required<Pick<HubInfo, 'feesReceiver'>>,
        request: EnvelopingTypes.RelayRequestStruct
      ) => Promise<EnvelopingTxRequest>;
    };

    before(function () {
      config.util.extendDeep(config, {
        EnvelopingConfig: FAKE_ENVELOPING_CONFIG,
      });
    });

    after(function () {
      config.util.extendDeep(config, originalConfig);
    });

    beforeEach(function () {
      relayClient = new RelayClient() as unknown as RelayClientExposed;
      relayClient._provider = {
        _isProvider: true,
        getTransactionCount: sandbox.stub().resolves(FAKE_TX_COUNT),
        getNetwork: sandbox.stub().resolves({
          chainId: FAKE_CHAIN_ID,
        } as Network),
      } as unknown as providers.Provider;

      forwarderStub = {
        nonce: sandbox.stub(),
      } as typeof forwarderStub;

      connectForwarderFactoryStub = sandbox
        .stub(IForwarder__factory, 'connect')
        .returns(forwarderStub);

      accountManagerStub = {
        sign: sandbox
          .stub(AccountManager.prototype, 'sign')
          .resolves(FAKE_SIGNATURE),
      } as typeof accountManagerStub;
    });

    it('should connect to forwarder', async function () {
      forwarderStub.nonce.resolves(BigNumber.from(123));
      await relayClient._prepareRelayHttpRequest(
        {
          feesReceiver: constants.AddressZero,
        },
        FAKE_RELAY_REQUEST
      );

      expect(connectForwarderFactoryStub).to.have.been.called;
      expect(connectForwarderFactoryStub).to.have.been.calledWith();
    });

    it('should return request with updated nonce from forwarder', async function () {
      const expectedNonce = BigNumber.from((Math.random() * 100).toFixed(0));
      forwarderStub.nonce.resolves(expectedNonce);
      const {
        relayRequest: {
          request: { nonce: actualNonce },
        },
      } = await relayClient._prepareRelayHttpRequest(
        {
          feesReceiver: constants.AddressZero,
        },
        FAKE_RELAY_REQUEST
      );

      expect(actualNonce).to.equal(expectedNonce);
    });

    it('should return tx request with given relay request body except for nonce', async function () {
      const expectedRelayRequestBody: RelayRequestBody = {
        ...FAKE_RELAY_REQUEST.request,
        nonce: forwarderStub.nonce.returnValues[0] as unknown as BigNumberish,
      };
      const {
        relayRequest: { request: actualRelayRequestBody },
      } = await relayClient._prepareRelayHttpRequest(
        {
          feesReceiver: constants.AddressZero,
        },
        FAKE_RELAY_REQUEST
      );

      expect(actualRelayRequestBody).to.deep.equal(expectedRelayRequestBody);
    });

    it('should return tx request with given relay request data + fees receiver from given hub info', async function () {
      const expectedRelayRequestData: UserDefinedRelayData = {
        ...FAKE_RELAY_REQUEST.relayData,
        feesReceiver: undefined,
      };
      const {
        relayRequest: { relayData: actualRelayRequestData },
      } = await relayClient._prepareRelayHttpRequest(
        {} as HubInfo,
        FAKE_RELAY_REQUEST
      );

      expect(actualRelayRequestData).to.deep.equal(expectedRelayRequestData);
    });

    it('should return tx request with updated fees receiver from given hub info', async function () {
      const expectedFeesReceiver = 'FAKE_RECEIVER';
      const {
        relayRequest: {
          relayData: { feesReceiver: actualFeesReceiver },
        },
      } = await relayClient._prepareRelayHttpRequest(
        { feesReceiver: expectedFeesReceiver } as HubInfo,
        FAKE_RELAY_REQUEST
      );

      expect(actualFeesReceiver).to.equal(expectedFeesReceiver);
    });

    it('should return relay metadata with relay hub address from request', async function () {
      const expectedRelayHubAddress = 'RELAY_HUB_ADDRESS';
      const {
        metadata: { relayHubAddress: actualRelayHubAddress },
      } = await relayClient._prepareRelayHttpRequest({} as HubInfo, {
        ...FAKE_RELAY_REQUEST,
        request: {
          ...FAKE_RELAY_REQUEST.request,
          relayHub: expectedRelayHubAddress,
        },
      });

      expect(actualRelayHubAddress).to.equal(expectedRelayHubAddress);
    });

    it('should sign the updated request', async function () {
      forwarderStub.nonce.resolves(0 as unknown as BigNumber);
      const signStub = accountManagerStub.sign;
      const expectedFeesReceiver = Wallet.createRandom().address;
      await relayClient._prepareRelayHttpRequest(
        {
          feesReceiver: expectedFeesReceiver,
        } as HubInfo,
        {
          ...FAKE_RELAY_REQUEST,
        }
      );

      expect(signStub).to.have.been.called;
      expect(signStub).to.have.been.calledWith({
        request: {
          ...FAKE_RELAY_REQUEST.request,
          nonce: await forwarderStub.nonce(),
        },
        relayData: {
          ...FAKE_RELAY_REQUEST.relayData,
          feesReceiver: expectedFeesReceiver,
        },
      } as RelayRequest);
    });

    it(`should emit sign request 'sign-request' `, async function () {
      const emitStub = sandbox.stub();
      (relayClient as unknown as EnvelopingEventEmitter).emit = emitStub;
      await relayClient._prepareRelayHttpRequest(
        {} as HubInfo,
        FAKE_RELAY_REQUEST
      );

      expect(emitStub).to.have.been.called;
      expect(emitStub).to.have.been.calledWith(
        envelopingEvents['sign-request']
      );
    });

    it('should return relay metadata with signature from account manager', async function () {
      const expectedSignature = FAKE_SIGNATURE;
      const {
        metadata: { signature: actualSignature },
      } = await relayClient._prepareRelayHttpRequest({} as HubInfo, {
        ...FAKE_RELAY_REQUEST,
        request: {
          ...FAKE_RELAY_REQUEST.request,
        },
      });

      expect(actualSignature).to.equal(expectedSignature);
    });
  });

  describe('_calculateGasPrice', function () {
    type RelayClientExposed = {
      _calculateGasPrice: () => Promise<BigNumber>;
    };
    let provider: SinonStubbedInstance<providers.BaseProvider>;
    let relayClient: RelayClientExposed;
    let envelopingConfig: EnvelopingConfig;

    beforeEach(function () {
      envelopingConfig = {
        chainId: 33,
        clientId: 1,
        deployVerifierAddress: '',
        forwarderAddress: '',
        gasPriceFactorPercent: 0.2,
        relayVerifierAddress: '',
        relayHubAddress: '',
        smartWalletFactoryAddress: '',
        sliceSize: 0,
        relayTimeoutGrace: 0,
        relayLookupWindowParts: 0,
        relayLookupWindowBlocks: 0,
        maxRelayNonceGap: 0,
        minGasPrice: 60000,
        methodSuffix: '',
        preferredRelays: [],
        onlyPreferredRelays: true,
        jsonStringifyRequest: true,
        logLevel: 0,
      };

      relayClient = new RelayClient() as unknown as RelayClientExposed;
      provider = sandbox.createStubInstance(providers.JsonRpcProvider);
      (
        relayClient as unknown as {
          _envelopingConfig: EnvelopingConfig;
        }
      )._envelopingConfig = envelopingConfig;
      (
        relayClient as unknown as {
          _provider: providers.Provider;
        }
      )._provider = provider;
    });

      it('should return minGasPrice', async function () {
        const estimateGas = BigNumber.from(10000);
        provider.getGasPrice.returns(Promise.resolve(estimateGas));
        const gasPrice = await relayClient._calculateGasPrice();
  
        expect(gasPrice.toString()).to.be.equal(
          envelopingConfig.minGasPrice.toString()
        );
      });
  
      it('should return gas price with factor', async function () {
        const estimateGas = BigNumber.from(60000);
        provider.getGasPrice.returns(Promise.resolve(estimateGas));
        const gasPrice = await relayClient._calculateGasPrice();
        const bigGasPriceFactorPercent = BigNumberJs(
          envelopingConfig.gasPriceFactorPercent
        );
        const bigEstimateGas = BigNumberJs(estimateGas.toString());
        const estimatedGas = bigEstimateGas.multipliedBy(
          bigGasPriceFactorPercent.plus(1).toString()
        );
  
        expect(gasPrice.toString()).to.be.equal(estimatedGas.toString());
      });
    });

  describe('isSmartWalletOwner', function () {
    const originalConfig = { ...config };
    let provider: SinonStubbedInstance<providers.BaseProvider>;
    let relayClient: RelayClient;
    let forwarderStub: Sinon.SinonStubbedInstance<IForwarder>;
    let smartWalletAddress: string;
    let owner: string;

    before(function () {
      config.util.extendDeep(config, {
        EnvelopingConfig: FAKE_ENVELOPING_CONFIG,
      });
    });

    after(function () {
      config.util.extendDeep(config, originalConfig);
    });

    beforeEach(function () {
      smartWalletAddress = createRandomAddress();
      owner = createRandomAddress();

      relayClient = new RelayClient();
      provider = sandbox.createStubInstance(providers.JsonRpcProvider);
      (
        relayClient as unknown as {
          _provider: providers.Provider;
        }
      )._provider = provider;
      const expectedOwner = utils.solidityKeccak256(['address'], [owner]);
      forwarderStub = {
        getOwner: sandbox.stub().returns(Promise.resolve(expectedOwner)),
      } as typeof forwarderStub;
      sandbox.stub(IForwarder__factory, 'connect').returns(forwarderStub);
    });

    afterEach(function () {
      sandbox.restore();
    });

    it('should return true if its the owner of the smart wallet', async function () {
      const verify = await relayClient.isSmartWalletOwner(smartWalletAddress, owner);
      expect(verify).to.be.true;
    });

    it('shoudl return false if its not the owner of the smart wallet', async function () {
      const verify = await relayClient.isSmartWalletOwner(smartWalletAddress, '0x02');
      expect(verify).to.be.false;
    });
    
  });
});
