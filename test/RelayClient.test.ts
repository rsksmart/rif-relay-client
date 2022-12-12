import type { Network } from '@ethersproject/networks';
import {
  EnvelopingTypes,
  IForwarder,
  IForwarder__factory,
} from '@rsksmart/rif-relay-contracts';
import type { PromiseOrValue } from '@rsksmart/rif-relay-contracts/dist/typechain-types/common';
import { BigNumber as BigNumberJs } from 'bignumber.js';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import { BigNumber, BigNumberish, constants, providers, Wallet } from 'ethers';
import { solidityKeccak256 } from 'ethers/lib/utils';
import Sinon, { SinonStubbedInstance } from 'sinon';
import sinonChai from 'sinon-chai';
import type { EnvelopingConfig } from 'src/common/config.types';
import AccountManager from '../src/AccountManager';
import type { HubInfo } from '../src/common/relayHub.types';
import type {
  DeployRequest,
  EnvelopingRequest,
  RelayRequest,
  UserDefinedEnvelopingRequest,
  UserDefinedRelayData,
  UserDefinedRelayRequest,
} from '../src/common/relayRequest.types';
import type { EnvelopingTxRequest } from '../src/common/relayTransaction.types';
import { MISSING_CALL_FORWARDER } from '../src/constants/errorMessages';
import EnvelopingEventEmitter, {
  envelopingEvents,
} from '../src/events/EnvelopingEventEmitter';
import RelayClient, {
  RequestConfig,
  TokenGasEstimationParams,
} from '../src/RelayClient';
import { FAKE_ENVELOPING_CONFIG } from './config.fakes';
import { FAKE_HUB_INFO } from './relayHub.fakes';
import {
  FAKE_DEPLOY_REQUEST,
  FAKE_ENVELOPING_REQUEST_DATA,
  FAKE_RELAY_REQUEST,
  FAKE_RELAY_REQUEST_BODY,
} from './request.fakes';

use(sinonChai);
use(chaiAsPromised);
const sandbox = Sinon.createSandbox();
const createRandomAddress = () => Wallet.createRandom().address;

const FAKE_TX_COUNT = 456;
const FAKE_CHAIN_ID = 33;
const FAKE_GAS_PRICE = BigNumber.from(123);
const FAKE_SIGNATURE = 'FAKE_SIGNATURE';

describe('RelayClient', function () {
  const originalConfig = { ...config };
  before(function () {
    config.util.extendDeep(config, {
      EnvelopingConfig: FAKE_ENVELOPING_CONFIG,
    });
  });

  after(function () {
    config.util.extendDeep(config, originalConfig);
  });

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

  describe('methods', function () {
    type RelayClientExposed = {
      _envelopingConfig: EnvelopingConfig;
      _provider: providers.Provider;
      _prepareRelayHttpRequest: (
        hubInfo: Required<Pick<HubInfo, 'feesReceiver'>>,
        request: EnvelopingTypes.RelayRequestStruct
      ) => Promise<EnvelopingTxRequest>;
      _getEnvelopingRequestDetails: (
        request: UserDefinedEnvelopingRequest,
        requestConfig: RequestConfig
      ) => Promise<EnvelopingRequest>;
      _calculateGasPrice: () => Promise<BigNumberish>;
      _applyGasCorrectionFactor: (
        estimation: BigNumberish,
        esimatedGasCorrectFactor: BigNumberish
      ) => BigNumber;
    } & {
      [key in keyof RelayClient]: RelayClient[key];
    };

    let relayClient: RelayClientExposed;
    let forwarderStub: Sinon.SinonStubbedInstance<IForwarder>;

    beforeEach(function () {
      relayClient = new RelayClient() as unknown as RelayClientExposed;
      relayClient._provider = {
        _isProvider: true,
        getTransactionCount: sandbox.stub().resolves(FAKE_TX_COUNT),
        getNetwork: sandbox.stub().resolves({
          chainId: FAKE_CHAIN_ID,
        } as Network),
        estimateGas: sandbox.stub().resolves(FAKE_GAS_PRICE),
      } as unknown as providers.Provider;

      forwarderStub = {
        nonce: sandbox.stub(),
        getOwner: sandbox.stub(),
      } as typeof forwarderStub;

      sandbox.stub(IForwarder__factory, 'connect').returns(forwarderStub);
    });

    describe('_prepareRelayHttpRequest', function () {
      let accountManagerStub: SinonStubbedInstance<AccountManager>;

      beforeEach(function () {
        accountManagerStub = {
          sign: sandbox
            .stub(AccountManager.prototype, 'sign')
            .resolves(FAKE_SIGNATURE),
        } as typeof accountManagerStub;
      });

      it('should return tx request with given relay request data with fees receiver from given hub info', async function () {
        const expectedRelayRequestData: UserDefinedRelayData = {
          ...FAKE_ENVELOPING_REQUEST_DATA,
          feesReceiver: FAKE_HUB_INFO.feesReceiver,
        };
        const {
          relayRequest: { relayData: actualRelayRequestData },
        } = await relayClient._prepareRelayHttpRequest(
          FAKE_HUB_INFO,
          FAKE_RELAY_REQUEST
        );

        expect(actualRelayRequestData).to.deep.equal(expectedRelayRequestData);
      });

      it('should return tx request with updated fees receiver from given hub info', async function () {
        const expectedFeesReceiver = FAKE_HUB_INFO.feesReceiver;
        const {
          relayRequest: {
            relayData: { feesReceiver: actualFeesReceiver },
          },
        } = await relayClient._prepareRelayHttpRequest(
          FAKE_HUB_INFO,
          FAKE_RELAY_REQUEST
        );

        expect(actualFeesReceiver).to.equal(expectedFeesReceiver);
      });

      it('should return relay metadata with relay hub address from request', async function () {
        const expectedRelayHubAddress = 'RELAY_HUB_ADDRESS';
        const {
          metadata: { relayHubAddress: actualRelayHubAddress },
        } = await relayClient._prepareRelayHttpRequest(FAKE_HUB_INFO, {
          ...FAKE_RELAY_REQUEST,
          request: {
            ...FAKE_RELAY_REQUEST_BODY,
            relayHub: expectedRelayHubAddress,
          },
        });

        expect(actualRelayHubAddress).to.equal(expectedRelayHubAddress);
      });

      it('should thow error when feesReceiver in hub info is zero address or not defined', async function () {
        await expect(
          relayClient._prepareRelayHttpRequest(
            {
              feesReceiver: constants.AddressZero,
            } as HubInfo,
            FAKE_RELAY_REQUEST
          ),
          'feesReceiver is zero address'
        ).to.be.rejectedWith('FeesReceiver has to be a valid non-zero address');
        await expect(
          relayClient._prepareRelayHttpRequest(
            {} as HubInfo,
            FAKE_RELAY_REQUEST
          ),
          'feesReceiver is undefined'
        ).to.be.rejectedWith('FeesReceiver has to be a valid non-zero address');
      });

      it('should sign the updated request', async function () {
        forwarderStub.nonce.resolves(
          BigNumber.from(await FAKE_RELAY_REQUEST.request.nonce)
        );
        const signStub = accountManagerStub.sign;
        const expectedFeesReceiver = FAKE_HUB_INFO.feesReceiver;
        await relayClient._prepareRelayHttpRequest(FAKE_HUB_INFO, {
          ...FAKE_RELAY_REQUEST,
        });

        expect(signStub).to.have.been.called;
        expect(signStub).to.have.been.calledWith({
          request: {
            ...FAKE_RELAY_REQUEST_BODY,
            nonce: await forwarderStub.nonce(),
          },
          relayData: {
            ...FAKE_ENVELOPING_REQUEST_DATA,
            feesReceiver: expectedFeesReceiver,
          },
        } as RelayRequest);
      });

      it(`should emit sign request 'sign-request' `, async function () {
        const emitStub = sandbox.stub();
        (relayClient as unknown as EnvelopingEventEmitter).emit = emitStub;
        await relayClient._prepareRelayHttpRequest(
          FAKE_HUB_INFO,
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
        } = await relayClient._prepareRelayHttpRequest(FAKE_HUB_INFO, {
          ...FAKE_RELAY_REQUEST,
          request: {
            ...FAKE_RELAY_REQUEST_BODY,
          },
        });

        expect(actualSignature).to.equal(expectedSignature);
      });
    });

    describe('_getEnvelopingRequestDetails', function () {
      it('should throw when callForwarder is not present in relay data', async function () {
        const call = relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            relayData: {
              ...FAKE_ENVELOPING_REQUEST_DATA,
              callForwarder: undefined,
            },
          } as unknown as UserDefinedEnvelopingRequest,
          {}
        );

        await expect(call).to.be.eventually.rejected;
        await expect(call).to.be.eventually.rejectedWith(
          MISSING_CALL_FORWARDER
        );
      });

      it('should return request with callVerifier from config when not present in the deployment request', async function () {
        const expectedCallVerifier =
          FAKE_ENVELOPING_CONFIG.deployVerifierAddress;
        const {
          relayData: { callVerifier: actualCallVerifier },
        } = await relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            relayData: {
              ...FAKE_ENVELOPING_REQUEST_DATA,
              callVerifier: undefined,
            },
          },
          {}
        );

        expect(actualCallVerifier).to.equal(expectedCallVerifier);
      });

      it('should return request with callVerifier from config when not present in the relay request', async function () {
        const expectedCallVerifier =
          FAKE_ENVELOPING_CONFIG.relayVerifierAddress;
        const {
          relayData: { callVerifier: actualCallVerifier },
        } = await relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_RELAY_REQUEST,
            relayData: {
              ...FAKE_ENVELOPING_REQUEST_DATA,
              callVerifier: undefined,
            },
          },
          {}
        );

        expect(actualCallVerifier).to.equal(expectedCallVerifier);
      });

      it('should throw when call verifier is not passed or configured', async function () {
        relayClient._envelopingConfig = {
          ...FAKE_ENVELOPING_CONFIG,
          relayVerifierAddress: undefined,
          deployVerifierAddress: undefined,
        } as unknown as EnvelopingConfig;

        const call = relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_RELAY_REQUEST,
            relayData: {
              ...FAKE_ENVELOPING_REQUEST_DATA,
              callVerifier: undefined,
            },
          },
          {}
        );

        await expect(call).to.be.eventually.rejected;
        await expect(call).to.be.eventually.rejectedWith(
          'No call verifier present. Check your configuration.'
        );
      });

      it('should return request with fees receiver set to zero address if none given', async function () {
        const expectedFeesReceiver = constants.AddressZero;

        const {
          relayData: { feesReceiver: actualFeesReceiver },
        } = await relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            relayData: {
              ...FAKE_ENVELOPING_REQUEST_DATA,
              feesReceiver: undefined,
            },
          },
          {}
        );

        expect(actualFeesReceiver.toString()).to.equal(expectedFeesReceiver);
      });

      it('should return request with gasPrice from request data', async function () {
        const expectedGasPrice = FAKE_DEPLOY_REQUEST.relayData.gasPrice;
        const {
          relayData: { gasPrice: actualGasPrice },
        } = await relayClient._getEnvelopingRequestDetails(
          FAKE_RELAY_REQUEST,
          {}
        );

        expect(actualGasPrice).to.equal(expectedGasPrice);
      });

      it('should return request with gasPrice from calculation if none set in request data', async function () {
        const expectedGasPrice = BigNumber.from(
          (Math.random() * 100).toFixed(0)
        );
        relayClient._calculateGasPrice = sandbox
          .stub()
          .resolves(expectedGasPrice);

        const {
          relayData: { gasPrice: actualGasPrice },
        } = await relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            relayData: {
              ...FAKE_DEPLOY_REQUEST.relayData,
              gasPrice: undefined,
            },
          },
          {}
        );

        expect(actualGasPrice).to.equal(expectedGasPrice);
      });

      it('should throw error if gasPrice not in request data or calculated', async function () {
        relayClient._calculateGasPrice = sandbox.stub().resolves(undefined);

        const call = relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            relayData: {
              ...FAKE_DEPLOY_REQUEST.relayData,
              gasPrice: undefined,
            },
          },
          {}
        );

        await expect(call).to.be.eventually.rejected;
        await expect(call).to.be.eventually.rejectedWith(
          'Could not get gas price for request'
        );
      });

      it('should throw if `data` field is not defined in request body', async function () {
        const call = relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            request: {
              ...FAKE_DEPLOY_REQUEST.request,
              data: undefined,
            },
          } as unknown as UserDefinedEnvelopingRequest,
          {}
        );

        await expect(call).to.be.eventually.rejected;
        await expect(call).to.be.eventually.rejectedWith(
          'Field `data` is not defined in request body.'
        );
      });

      it('should throw if `from` field is not defined in request body', async function () {
        const call = relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            request: {
              ...FAKE_DEPLOY_REQUEST.request,
              from: undefined,
            },
          } as unknown as UserDefinedEnvelopingRequest,
          {}
        );

        await expect(call).to.be.eventually.rejected;
        await expect(call).to.be.eventually.rejectedWith(
          'Field `from` is not defined in request body.'
        );
      });

      it('should throw if `to` field is not defined in request body', async function () {
        const call = relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            request: {
              ...FAKE_DEPLOY_REQUEST.request,
              to: undefined,
            },
          } as unknown as UserDefinedEnvelopingRequest,
          {}
        );

        await expect(call).to.be.eventually.rejected;
        await expect(call).to.be.eventually.rejectedWith(
          'Field `to` is not defined in request body.'
        );
      });

      it('should return request with value 0 if it is not defined in request body', async function () {
        const expectedValue = constants.Zero;

        const {
          request: { value: actualValue },
        } = await relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            request: {
              ...FAKE_DEPLOY_REQUEST.request,
              value: undefined,
            },
          } as unknown as UserDefinedEnvelopingRequest,
          {}
        );

        expect(actualValue).to.equal(expectedValue);
      });

      it('should throw if `tokenAmount` is not defined in request body', async function () {
        const expectedTokenAmount = constants.Zero;

        const {
          request: { tokenAmount: actualTokenAmount },
        } = await relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            request: {
              ...FAKE_DEPLOY_REQUEST.request,
              tokenAmount: undefined,
            },
          } as unknown as UserDefinedEnvelopingRequest,
          {}
        );

        expect(actualTokenAmount).to.equal(expectedTokenAmount);
      });

      it('should throw if `tokenContract` is not defined in request body', async function () {
        const call = relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            request: {
              ...FAKE_DEPLOY_REQUEST.request,
              tokenContract: undefined,
            },
          } as unknown as UserDefinedEnvelopingRequest,
          {}
        );

        await expect(call).to.be.eventually.rejected;
        await expect(call).to.be.eventually.rejectedWith(
          'Field `tokenContract` is not defined in request body.'
        );
      });

      it('should get nonce value from forwarder if none defined in request body', async function () {
        const expectedNonce = BigNumber.from((Math.random() * 100).toFixed(0));
        forwarderStub.nonce.resolves(expectedNonce);
        const {
          request: { nonce: actualNonce },
        } = await relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            request: {
              ...FAKE_DEPLOY_REQUEST.request,
              nonce: undefined,
            },
          } as unknown as EnvelopingRequest,
          {}
        );

        expect(actualNonce).to.equal(expectedNonce);
      });

      it('should return request with given relay hub address', async function () {
        const expectedRelayHubAddr = FAKE_DEPLOY_REQUEST.request.relayHub;

        const {
          request: { relayHub: actualRelayHub },
        } = await relayClient._getEnvelopingRequestDetails(
          FAKE_DEPLOY_REQUEST,
          {}
        );

        expect(actualRelayHub).to.equal(expectedRelayHubAddr);
      });

      it('should return request with relay hub address from configuration if not defined in the request', async function () {
        const expectedRelayHubAddr = FAKE_ENVELOPING_CONFIG.relayHubAddress;

        const {
          request: { relayHub: actualRelayHub },
        } = await relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            request: {
              ...FAKE_DEPLOY_REQUEST.request,
              relayHub: undefined,
            },
          },
          {}
        );

        expect(actualRelayHub).to.equal(expectedRelayHubAddr);
      });

      it('should throw if relay hub address is not defined in the request or configuration', async function () {
        relayClient._envelopingConfig = {
          ...FAKE_ENVELOPING_CONFIG,
          relayHubAddress: undefined,
        } as unknown as EnvelopingConfig;

        const call = relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            request: {
              ...FAKE_DEPLOY_REQUEST.request,
              relayHub: undefined,
            },
          },
          {}
        );

        await expect(call).to.be.eventually.rejected;
        await expect(call).to.be.eventually.rejectedWith(
          'No relay hub address has been given or configured'
        );
      });

      it('should return request with given tokenGas', async function () {
        const {
          request: { tokenGas: expectedTokenGas },
        } = FAKE_DEPLOY_REQUEST;
        const {
          request: { tokenGas: actualTokenGas },
        } = await relayClient._getEnvelopingRequestDetails(
          FAKE_DEPLOY_REQUEST,
          {}
        );

        expect(actualTokenGas).to.equal(expectedTokenGas);
      });

      it('should return request with calculated tokenGas if none given', async function () {
        const expectedTokenGas = BigNumber.from(
          (Math.random() * 100).toFixed(0)
        );
        const estimateTokenTransferGasStub = sandbox
          .stub()
          .resolves(expectedTokenGas);
        relayClient.estimateTokenTransferGas = estimateTokenTransferGasStub;
        const request: UserDefinedEnvelopingRequest = {
          ...FAKE_DEPLOY_REQUEST,
          request: {
            ...FAKE_DEPLOY_REQUEST.request,
            tokenGas: undefined,
          },
        };
        const requestConfig: RequestConfig = {
          isSmartWalletDeploy: true,
          preDeploySWAddress: Wallet.createRandom().address,
        };
        const expectedEstimationProps: TokenGasEstimationParams = {
          callForwarder: request.relayData.callForwarder,
          gasPrice: request.relayData.gasPrice as PromiseOrValue<BigNumberish>,
          tokenAmount: request.request.tokenAmount,
          tokenContract: request.request.tokenContract,
          preDeploySWAddress: requestConfig.preDeploySWAddress,
          isSmartWalletDeploy: requestConfig.isSmartWalletDeploy,
        };

        const {
          request: { tokenGas: actualTokenGas },
        } = await relayClient._getEnvelopingRequestDetails(
          request,
          requestConfig
        );

        expect(estimateTokenTransferGasStub).to.have.been.called;
        expect(estimateTokenTransferGasStub).to.have.been.calledWith(
          expectedEstimationProps
        );
        expect(actualTokenGas).to.equal(expectedTokenGas);
      });

      it('should return given gas limit in the request body for relay request', async function () {
        const {
          request: { gas: expectedGas },
        } = FAKE_RELAY_REQUEST;
        const {
          request: { gas: actualGas },
        } = (await relayClient._getEnvelopingRequestDetails(
          FAKE_RELAY_REQUEST,
          {}
        )) as RelayRequest;

        expect(actualGas).to.equal(expectedGas);
      });

      it('should return given force gas limnit from request config in the request body for relay request', async function () {
        const expectedGas = BigNumber.from((Math.random() * 100).toFixed(0));
        const {
          request: { gas: actualGas },
        } = (await relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_RELAY_REQUEST,
            request: {
              ...FAKE_RELAY_REQUEST_BODY,
              gas: undefined,
            },
          } as unknown as UserDefinedRelayRequest,
          {
            forceGasLimit: expectedGas.toString(),
          }
        )) as RelayRequest;

        expect(actualGas.toString()).to.equal(expectedGas.toString());
      });

      it('should throw if no gas limit given to relay request or forceGasLimit to request config', async function () {
        relayClient.estimateInternalCallGas = sandbox
          .stub()
          .resolves(undefined);
        const call = relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_RELAY_REQUEST,
            request: {
              ...FAKE_RELAY_REQUEST_BODY,
              gas: undefined,
            },
          },
          {}
        );

        await expect(call).to.be.eventually.rejected;
        await expect(call).to.be.eventually.rejectedWith(
          'Gas limit value (`gas`) is required in a relay request.'
        );
      });

      it('should not throw if no gas limit given to deploy request or forceGasLimit to request config', async function () {
        const call = relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            request: {
              ...FAKE_DEPLOY_REQUEST.request,
              gas: undefined,
            },
          },
          {}
        );

        await expect(call).not.to.be.eventually.rejectedWith(
          'Gas limit value (`gas`) is required in a relay request.'
        );
      });

      it('should return given index for a deoploy request', async function () {
        const expectedIndex = FAKE_DEPLOY_REQUEST.request.index;
        const {
          request: { index: actualIndex },
        } = (await relayClient._getEnvelopingRequestDetails(
          FAKE_DEPLOY_REQUEST,
          {}
        )) as DeployRequest;

        expect(actualIndex).to.equal(expectedIndex);
      });

      it('should return zero if not given index value for a deoploy request', async function () {
        const expectedIndex = 0;
        const {
          request: { index: actualIndex },
        } = (await relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            request: {
              ...FAKE_DEPLOY_REQUEST.request,
              index: undefined,
            },
          },
          {}
        )) as DeployRequest;

        expect(actualIndex).to.equal(expectedIndex);
      });

      it('should return given recoverer for a deoploy request', async function () {
        const expectedRecoverer = FAKE_DEPLOY_REQUEST.request.recoverer;
        const {
          request: { recoverer: actualRecoverer },
        } = (await relayClient._getEnvelopingRequestDetails(
          FAKE_DEPLOY_REQUEST,
          {}
        )) as DeployRequest;

        expect(actualRecoverer).to.equal(expectedRecoverer);
      });

      it('should return zero address if not given recoverer value for a deoploy request', async function () {
        const expectedRecoverer = constants.AddressZero;
        const {
          request: { recoverer: actualRecoverer },
        } = (await relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            request: {
              ...FAKE_DEPLOY_REQUEST.request,
              recoverer: undefined,
            },
          },
          {}
        )) as DeployRequest;

        expect(actualRecoverer).to.equal(expectedRecoverer);
      });
    });

    describe('estimateInternalCallGas', function () {
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
      });

      it('should return the estimation applying the internal correction', async function () {
        const estimateGas = BigNumber.from(10000);
        relayClient._provider.estimateGas = sandbox
          .stub()
          .resolves(estimateGas);
        const internalEstimationCorrection = 5000;
        const estimation = await relayClient.estimateInternalCallGas({
          data: relayRequest.request.data,
          from: relayRequest.request.from,
          to: relayRequest.request.to,
          gasPrice: relayRequest.relayData.gasPrice,
          internalEstimationCorrection,
        });
        const expectedEstimation = estimateGas.sub(
          internalEstimationCorrection
        );

        expect(estimation.toString()).to.be.equal(
          expectedEstimation.toString()
        );
      });

      it('should return the estimation without applying the internal correction', async function () {
        const expectedGasEst = BigNumber.from(4000);
        relayClient._provider.estimateGas = sandbox
          .stub()
          .resolves(expectedGasEst);
        const internalEstimationCorrection = 5000;
        const actualGasEst = await relayClient.estimateInternalCallGas({
          data: relayRequest.request.data,
          from: relayRequest.request.from,
          to: relayRequest.request.to,
          gasPrice: relayRequest.relayData.gasPrice,
          internalEstimationCorrection,
        });

        expect(actualGasEst.toString()).to.be.equal(expectedGasEst.toString());
      });

      it('should return estimation without applying gas correction factor when addExternalCorrection is set to false', async function () {
        relayClient._applyGasCorrectionFactor = () => BigNumber.from(7500);
        const stubApplyGasCorrection = sandbox
          .stub(
            relayClient as unknown as {
              _applyGasCorrectionFactor: () => BigNumber;
            },
            '_applyGasCorrectionFactor'
          )
          .returns(BigNumber.from(7500));
        const estimateGas = BigNumber.from(10000);
        relayClient._provider.estimateGas = sandbox
          .stub()
          .resolves(estimateGas);
        const internalEstimationCorrection = 5000;
        const estimation = await relayClient.estimateInternalCallGas({
          data: relayRequest.request.data,
          from: relayRequest.request.from,
          to: relayRequest.request.to,
          gasPrice: relayRequest.relayData.gasPrice,
          internalEstimationCorrection,
          addExternalCorrection: false,
        });
        const expectedEstimation = estimateGas.sub(
          internalEstimationCorrection
        );

        expect(estimation.toString()).to.be.equal(
          expectedEstimation.toString()
        );
        expect(stubApplyGasCorrection.calledOnce).to.be.false;
      });

      it('should return estimation applying gas correction factor when addExternalCorrection is set to true', async function () {
        const expectedEstimation = BigNumber.from(7_500);
        const stubApplyGasCorrection = sandbox
          .stub()
          .returns(expectedEstimation);
        relayClient._applyGasCorrectionFactor = stubApplyGasCorrection;
        relayClient._provider.estimateGas = sandbox
          .stub()
          .resolves(BigNumber.from(10_000));
        const internalEstimationCorrection = 5_000;
        const estimation = await relayClient.estimateInternalCallGas({
          data: relayRequest.request.data,
          from: relayRequest.request.from,
          to: relayRequest.request.to,
          gasPrice: relayRequest.relayData.gasPrice,
          internalEstimationCorrection,
          addExternalCorrection: true,
        });

        expect(estimation).to.be.equal(expectedEstimation);
        expect(stubApplyGasCorrection).to.be.calledOnce;
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
      let smartWalletAddress: string;
      let owner: string;
      let ownerSolidityHash: string;

      beforeEach(function () {
        smartWalletAddress = createRandomAddress();
        owner = createRandomAddress();
        ownerSolidityHash = solidityKeccak256(['address'], [owner]);
        forwarderStub.getOwner.resolves(ownerSolidityHash);
      });

      afterEach(function () {
        sandbox.restore();
      });

      it('should return true if its the owner of the smart wallet', async function () {
        const verify = await relayClient.isSmartWalletOwner(
          smartWalletAddress,
          owner
        );

        expect(verify).to.be.true;
      });

      it('shoudl return false if its not the owner of the smart wallet', async function () {
        const verify = await relayClient.isSmartWalletOwner(
          smartWalletAddress,
          '0x02'
        );

        expect(verify).to.be.false;
      });
    });
  });
});
