import type { Network } from '@ethersproject/networks';
import {
  DeployVerifier,
  DeployVerifier__factory,
  EnvelopingTypes,
  IForwarder,
  IForwarder__factory,
  ISmartWalletFactory,
  IWalletFactory__factory,
  RelayHub,
  RelayHub__factory,
  RelayVerifier,
  RelayVerifier__factory,
} from '@rsksmart/rif-relay-contracts';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BigNumber, BigNumberish, constants, providers, Transaction, Wallet, utils, errors } from 'ethers';

import type { TransactionResponse, TransactionReceipt } from '@ethersproject/providers';
import { solidityKeccak256 } from 'ethers/lib/utils';
import Sinon, { SinonStub, SinonStubbedInstance } from 'sinon';
import sinonChai from 'sinon-chai';
import { HttpClient } from '../src/api/common';
import type { EnvelopingConfig } from '../src/common/config.types';
import type { HubInfo, RelayInfo, RelayManagerData } from '../src/common/relayHub.types';
import AccountManager from '../src/AccountManager';
import type {
  DeployRequest,
  EnvelopingRequest,
  EnvelopingRequestData,
  RelayRequest,
  UserDefinedEnvelopingRequest,
  UserDefinedRelayData,
  UserDefinedRelayRequestBody,
} from '../src/common/relayRequest.types';
import type { EnvelopingTxRequest } from '../src/common/relayTransaction.types';
import {
  MISSING_CALL_FORWARDER,
  NOT_RELAYED_TRANSACTION,
} from '../src/constants/errorMessages';
import EnvelopingEventEmitter, {
  envelopingEvents,
} from '../src/events/EnvelopingEventEmitter';
import RelayClient, {
} from '../src/RelayClient';
import { FAKE_ENVELOPING_CONFIG } from './config.fakes';
import { FAKE_HUB_INFO } from './relayHub.fakes';
import {
  FAKE_DEPLOY_REQUEST,
  FAKE_DEPLOY_TRANSACTION_REQUEST,
  FAKE_ENVELOPING_REQUEST_DATA,
  FAKE_RELAY_REQUEST,
  FAKE_RELAY_REQUEST_BODY,
  FAKE_RELAY_TRANSACTION_REQUEST
} from './request.fakes';

import * as etherUtils from '@ethersproject/transactions';
import * as clientConfiguration from '../src/common/clientConfigurator';
import * as relayUtils from '../src/utils';
import * as gasEstimator from '../src/gasEstimator/gasEstimator';


use(sinonChai);
use(chaiAsPromised);
const sandbox = Sinon.createSandbox();
const createRandomAddress = () => Wallet.createRandom().address;
const createRandomBigNumber = (base: number) => BigNumber.from((Math.random() * base).toFixed(0));

const FAKE_TX_COUNT = 456;
const FAKE_CHAIN_ID = 33;
const FAKE_GAS_PRICE = BigNumber.from(123);
const FAKE_SIGNATURE = 'FAKE_SIGNATURE';

describe('RelayClient', function () {
  beforeEach(function () {
    sandbox.replace(clientConfiguration, 'getEnvelopingConfig', () => FAKE_ENVELOPING_CONFIG);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('constructor', function () {
    it('should store httpClient', function () {
      const expectedHttpClient: HttpClient =
        sandbox.createStubInstance(HttpClient);
      const relayClient = new RelayClient();

      (relayClient as unknown as { _httpClient: HttpClient })._httpClient =
      expectedHttpClient;

      expect(relayClient).to.be.instanceOf(RelayClient);
      expect(
        (relayClient as unknown as { _httpClient: HttpClient })._httpClient,
        'Provider'
      ).to.equal(expectedHttpClient);
    });
  });

  describe('methods', function () {
    type RelayClientExposed = {
      _envelopingConfig: EnvelopingConfig;
      _httpClient: HttpClient;
      _prepareHttpRequest: (
        _hubInfo: HubInfo,
        request: EnvelopingTypes.RelayRequestStruct
      ) => Promise<EnvelopingTxRequest>;
      _getEnvelopingRequestDetails: (
        request: UserDefinedEnvelopingRequest
      ) => Promise<EnvelopingRequest>;
      _calculateGasPrice: () => Promise<BigNumber>;
      _attemptRelayTransaction: (relayInfo: RelayInfo, envelopingTx: EnvelopingTxRequest) => Promise<Transaction>;
      _broadcastTx: (signedTx: string) => Promise<void>;
      _verifyEnvelopingRequest: (hubInfo: HubInfo, envelopingTx: EnvelopingTxRequest) => Promise<void>;
      _verifyWorkerBalance: (relayWorkerAddress: string, maxPossibleGas: BigNumber, gasPrice: BigNumberish) => Promise<void>;
      _verifyWithVerifiers: (envelopingTx: EnvelopingTxRequest) => Promise<void>;
      _verifyWithRelayHub: (relayWorkerAddress: string, envelopingTx: EnvelopingTxRequest, maxPossibleGas: BigNumber) => Promise<void>;
    } & {
        [key in keyof RelayClient]: RelayClient[key];
      };

    let relayClient: RelayClientExposed;
    let forwarderStub: Sinon.SinonStubbedInstance<IForwarder>;
    let factoryStub: Sinon.SinonStubbedInstance<ISmartWalletFactory>;
    let ethersLogger: utils.Logger;
    let providerStub: providers.Provider;

    beforeEach(function () {
      relayClient = new RelayClient() as unknown as RelayClientExposed;
      providerStub = {
        _isProvider: true,
        getTransactionCount: sandbox.stub().resolves(FAKE_TX_COUNT),
        getNetwork: sandbox.stub().resolves({
          chainId: FAKE_CHAIN_ID,
        } as Network),
        estimateGas: sandbox.stub().resolves(FAKE_GAS_PRICE),
      } as unknown as providers.Provider;

      sandbox.stub(clientConfiguration, 'getProvider').returns(providerStub);
      

      forwarderStub = {
        nonce: sandbox.stub(),
        getOwner: sandbox.stub(),
      } as typeof forwarderStub;

      factoryStub = {
        nonce: sandbox.stub()
      } as typeof factoryStub;

      sandbox.stub(IForwarder__factory, 'connect').returns(forwarderStub);
      sandbox.stub(IWalletFactory__factory, 'connect').returns(factoryStub);
      ethersLogger = new utils.Logger('1');
    });

    describe('_prepareHttpRequest', function () {
      let accountManagerStub: SinonStubbedInstance<AccountManager>;
      let fakeTokenGasEstimation: BigNumber;

      beforeEach(function () {
        fakeTokenGasEstimation = constants.Two;
        sandbox.stub(relayUtils, 'estimateTokenTransferGas').returns(Promise.resolve(fakeTokenGasEstimation));
        accountManagerStub = {
          sign: sandbox
            .stub(AccountManager.prototype, 'sign')
            .resolves(FAKE_SIGNATURE),
        } as typeof accountManagerStub;
      });

      it('should return relay metadata with relay hub address from request', async function () {
        const expectedRelayHubAddress = 'RELAY_HUB_ADDRESS';
        const {
          metadata: { relayHubAddress: actualRelayHubAddress },
        } = await relayClient._prepareHttpRequest(FAKE_HUB_INFO, {
          ...FAKE_RELAY_REQUEST,
          request: {
            ...FAKE_RELAY_REQUEST.request,
            relayHub: expectedRelayHubAddress,
          },
        });

        expect(actualRelayHubAddress).to.equal(expectedRelayHubAddress);
      });

      it.skip('should return tx request with fees receiver in request data from given hub info if no fees receiver given in request', async function () {
        const expectedRelayRequestData: UserDefinedRelayData = {
          ...FAKE_ENVELOPING_REQUEST_DATA,
          feesReceiver: FAKE_HUB_INFO.feesReceiver,
        };
        const {
          relayRequest: { relayData: actualRelayRequestData },
        } = await relayClient._prepareHttpRequest(FAKE_HUB_INFO, {
          ...FAKE_RELAY_REQUEST,
          relayData: {
            ...FAKE_RELAY_REQUEST.relayData,
            feesReceiver: undefined,
          } as unknown as EnvelopingRequestData,
        });

        expect(actualRelayRequestData).to.deep.equal(expectedRelayRequestData);
      });

      it('should thow error when feesReceiver in hub info is zero address or not defined', async function () {
        await expect(
          relayClient._prepareHttpRequest(
            {
              feesReceiver: constants.AddressZero,
            } as HubInfo,
            {
              ...FAKE_RELAY_REQUEST,
              relayData: {
                ...FAKE_RELAY_REQUEST.relayData,
                feesReceiver: constants.AddressZero,
              },
            }
          ),
          'feesReceiver is zero address'
        ).to.be.rejectedWith('FeesReceiver has to be a valid non-zero address');
        await expect(
          relayClient._prepareHttpRequest({} as HubInfo, {
            ...FAKE_RELAY_REQUEST,
            relayData: {
              ...FAKE_RELAY_REQUEST.relayData,
              feesReceiver: undefined,
            } as unknown as EnvelopingRequestData,
          }),
          'feesReceiver is undefined'
        ).to.be.rejectedWith('FeesReceiver has to be a valid non-zero address');
      });

      it.skip('should return tx request with fees receiver in request data from given hub info if fees receiver given in request is zero', async function () {
        const expectedRelayRequestData: UserDefinedRelayData = {
          ...FAKE_ENVELOPING_REQUEST_DATA,
          feesReceiver: FAKE_HUB_INFO.feesReceiver,
        };
        const {
          relayRequest: { relayData: actualRelayRequestData },
        } = await relayClient._prepareHttpRequest(FAKE_HUB_INFO, {
          ...FAKE_RELAY_REQUEST,
          relayData: {
            ...FAKE_RELAY_REQUEST.relayData,
            feesReceiver: constants.AddressZero,
          },
        });

        expect(actualRelayRequestData).to.deep.equal(expectedRelayRequestData);
      });

      it.skip("should return transaction request with 'tokenGas' in request data if it's greater than zero", async function () {
        const expectedRelayRequestData: UserDefinedRelayRequestBody = {
          ...FAKE_RELAY_REQUEST_BODY
        };

        const {
          relayRequest: { request: actualRelayRequest },
        } = await relayClient._prepareHttpRequest(FAKE_HUB_INFO, FAKE_RELAY_REQUEST);

        expect(actualRelayRequest).to.deep.equal(expectedRelayRequestData);
      });

      it.skip("should estimate 'tokenGas' if it's zero in the request", async function () {
        const expectedRelayRequestData: UserDefinedRelayRequestBody = {
          ...FAKE_RELAY_REQUEST_BODY,
          tokenGas: fakeTokenGasEstimation,
        };
        const {
          relayRequest: { request: actualRelayRequest },
        } = await relayClient._prepareHttpRequest(FAKE_HUB_INFO, {
          ...FAKE_RELAY_REQUEST,
          request: {
            ...FAKE_RELAY_REQUEST.request,
            tokenGas: constants.Zero
          },
        });

        expect(actualRelayRequest).to.deep.equal(expectedRelayRequestData);
      });

      it.skip('should sign the request', async function () {
        const expectedRelayRequestData: RelayRequest = {
          ...FAKE_RELAY_REQUEST,
          relayData: {
            ...FAKE_RELAY_REQUEST.relayData,
            feesReceiver: FAKE_HUB_INFO.feesReceiver
          }
        };

        const fakeTokenGas = constants.Two;
        sandbox.stub(relayUtils, 'estimateTokenTransferGas').returns(Promise.resolve(fakeTokenGas));
        forwarderStub.nonce.resolves(constants.Two);
        const signStub = accountManagerStub.sign;
        await relayClient._prepareHttpRequest(
          FAKE_HUB_INFO,
          FAKE_RELAY_REQUEST
        );

        expect(signStub).to.have.been.called;
        expect(signStub).to.have.been.calledWith(expectedRelayRequestData);
      });

      it(`should emit sign request 'sign-request' `, async function () {
        const emitStub = sandbox.stub();
        (relayClient as unknown as EnvelopingEventEmitter).emit = emitStub;
        await relayClient._prepareHttpRequest(
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
        } = await relayClient._prepareHttpRequest(FAKE_HUB_INFO, {
          ...FAKE_RELAY_REQUEST,
          request: {
            ...FAKE_RELAY_REQUEST.request,
          },
        });

        expect(actualSignature).to.equal(expectedSignature);
      });
    });

    describe('_getEnvelopingRequestDetails', function () {
      it('should throw when callForwarder is not present in relay data', async function () {
        const call = relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_RELAY_REQUEST,
            relayData: {
              ...FAKE_ENVELOPING_REQUEST_DATA,
              callForwarder: undefined,
            },
          } as unknown as UserDefinedEnvelopingRequest
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
          }
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
          }
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
          }
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
          }
        );

        expect(actualFeesReceiver.toString()).to.equal(expectedFeesReceiver);
      });

      it('should return request with gasPrice from request data', async function () {
        const expectedGasPrice = FAKE_DEPLOY_REQUEST.relayData.gasPrice;
        const {
          relayData: { gasPrice: actualGasPrice },
        } = await relayClient._getEnvelopingRequestDetails(
          FAKE_RELAY_REQUEST
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
          }
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
          }
        );

        await expect(call).to.be.eventually.rejected;
        await expect(call).to.be.eventually.rejectedWith(
          'Could not get gas price for request'
        );
      });

      it('should throw if `data` field is not defined in request body', async function () {
        const call = relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_RELAY_REQUEST,
            request: {
              ...FAKE_RELAY_REQUEST.request,
              data: undefined,
            },
          } as unknown as UserDefinedEnvelopingRequest
        );

        await expect(call).to.be.eventually.rejected;
        await expect(call).to.be.eventually.rejectedWith(
          'Field `data` is not defined in request body.'
        );
      });

      it('should throw if `index` field is not defined in deploy body', async function () {
        const call = relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            request: {
              ...FAKE_DEPLOY_REQUEST.request,
              index: undefined,
            },
          } as unknown as UserDefinedEnvelopingRequest
        );

        await expect(call).to.be.eventually.rejected;
        await expect(call).to.be.eventually.rejectedWith(
          'Field `index` is not defined in deploy body.'
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
          } as unknown as UserDefinedEnvelopingRequest
        );

        await expect(call).to.be.eventually.rejected;
        await expect(call).to.be.eventually.rejectedWith(
          'Field `from` is not defined in request body.'
        );
      });

      it('should throw if `to` field is not defined in request body', async function () {
        const call = relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_RELAY_REQUEST,
            request: {
              ...FAKE_RELAY_REQUEST.request,
              to: undefined,
            },
          } as unknown as UserDefinedEnvelopingRequest
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
          } as unknown as UserDefinedEnvelopingRequest
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
          } as unknown as UserDefinedEnvelopingRequest
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
          } as unknown as UserDefinedEnvelopingRequest
        );

        await expect(call).to.be.eventually.rejected;
        await expect(call).to.be.eventually.rejectedWith(
          'Field `tokenContract` is not defined in request body.'
        );
      });

      it('should get nonce value from factory if none defined in request body', async function () {
        const expectedNonce = BigNumber.from((Math.random() * 100).toFixed(0));
        factoryStub.nonce.resolves(expectedNonce);
        const {
          request: { nonce: actualNonce },
        } = await relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_DEPLOY_REQUEST,
            request: {
              ...FAKE_DEPLOY_REQUEST.request,
              nonce: undefined,
            },
          } as unknown as EnvelopingRequest
        );

        expect(actualNonce).to.equal(expectedNonce);
      });

      it('should get nonce value from forwarder if none defined in request body', async function () {
        const expectedNonce = BigNumber.from((Math.random() * 100).toFixed(0));
        forwarderStub.nonce.resolves(expectedNonce);
        const {
          request: { nonce: actualNonce },
        } = await relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_RELAY_REQUEST,
            request: {
              ...FAKE_RELAY_REQUEST.request,
              nonce: undefined,
            },
          } as unknown as EnvelopingRequest
        );

        expect(actualNonce).to.equal(expectedNonce);
      });

      it('should return request with given relay hub address', async function () {
        const expectedRelayHubAddr = FAKE_DEPLOY_REQUEST.request.relayHub;

        const {
          request: { relayHub: actualRelayHub },
        } = await relayClient._getEnvelopingRequestDetails(
          FAKE_DEPLOY_REQUEST
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
          }
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
          }
        );

        await expect(call).to.be.eventually.rejected;
        await expect(call).to.be.eventually.rejectedWith(
          'No relay hub address has been given or configured'
        );
      });

      it('should return request with given tokenGas equals to zero', async function () {
        const {
          request: { tokenGas: actualTokenGas },
        } = await relayClient._getEnvelopingRequestDetails(
          FAKE_DEPLOY_REQUEST
        );

        expect(actualTokenGas).to.equal(constants.Zero);
      });

      it('should return given gas limit in the request body for relay request', async function () {
        const {
          request: { gas: expectedGas },
        } = FAKE_RELAY_REQUEST;
        const {
          request: { gas: actualGas },
        } = (await relayClient._getEnvelopingRequestDetails(
          FAKE_RELAY_REQUEST
        )) as RelayRequest;

        expect(actualGas).to.equal(expectedGas);
      });

      it('should throw if no gas limit given to relay request', async function () {
        sandbox.stub(relayUtils, 'estimateInternalCallGas').resolves(undefined);
        const call = relayClient._getEnvelopingRequestDetails(
          {
            ...FAKE_RELAY_REQUEST,
            request: {
              ...FAKE_RELAY_REQUEST_BODY,
              gas: undefined,
            },
          }
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
          }
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
          FAKE_DEPLOY_REQUEST
        )) as DeployRequest;

        expect(actualIndex).to.equal(expectedIndex);
      });

      it('should return given recoverer for a deploy request', async function () {
        const expectedRecoverer = FAKE_DEPLOY_REQUEST.request.recoverer;
        const {
          request: { recoverer: actualRecoverer },
        } = (await relayClient._getEnvelopingRequestDetails(
          FAKE_DEPLOY_REQUEST
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
          }
        )) as DeployRequest;

        expect(actualRecoverer).to.equal(expectedRecoverer);
      });
    });

    describe('_calculateGasPrice', function () {

      it('should return minGasPrice when minGasPrice is higher than gas price from provider', async function () {
        const expectedGasPrice = 30000;
        relayClient._envelopingConfig.minGasPrice = expectedGasPrice;
        providerStub.getGasPrice = sandbox
          .stub()
          .callsFake(() => {
            console.log('getGasPrice called');
          })
          .resolves(BigNumber.from(2000));
        const actualGasPrice = await relayClient._calculateGasPrice();

        expect(actualGasPrice.toNumber()).to.be.equal(expectedGasPrice);
      });

      it('should return gas price multiplied by correction (factor + 1)', async function () {
        const estimateGas = BigNumber.from(60000);
        providerStub.getGasPrice = sandbox
          .stub()
          .resolves(estimateGas);
        const expectedGasEstimate = estimateGas.mul(
          FAKE_ENVELOPING_CONFIG.gasPriceFactorPercent + 1
        );
        const actualGasPrice = await relayClient._calculateGasPrice();

        expect(actualGasPrice.toString()).to.be.equal(
          expectedGasEstimate.toString()
        );
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

  
    describe('relayTransaction', function () {

      const relayInfo: RelayInfo = {
        hubInfo: FAKE_HUB_INFO,
        managerData: {
          url: 'fake_url'
        } as RelayManagerData
      };

      const envelopingRequest = {
        ...FAKE_RELAY_REQUEST,
        relayData: {
          ...FAKE_ENVELOPING_REQUEST_DATA
        },
      }

      const transaction = {} as Transaction;
      let selectNextRelayStub: SinonStub;
      let attemptRelayTransactionStub: SinonStub;
      
      beforeEach(function () {
        attemptRelayTransactionStub = sandbox.stub().resolves(transaction);
        relayClient._getEnvelopingRequestDetails = sandbox.stub().returns(FAKE_RELAY_REQUEST);
        relayClient._prepareHttpRequest = sandbox.stub();
        relayClient._verifyEnvelopingRequest = sandbox.stub().resolves(true);
        relayClient._attemptRelayTransaction = attemptRelayTransactionStub;
        selectNextRelayStub = sandbox.stub(relayUtils, 'selectNextRelay').resolves(relayInfo);
      });

      afterEach(function () {
        sandbox.restore();
      })

      it('should relay the transaction in the first attempt', async function () {
        const expectedTransaction = await relayClient.relayTransaction(envelopingRequest);

        expect(selectNextRelayStub).to.be.calledOnce;
        expect(expectedTransaction).to.be.equals(transaction);
      });

      it.skip('should relay the transaction after the first attempt', async function () {
        attemptRelayTransactionStub.onFirstCall().resolves(undefined);
        attemptRelayTransactionStub.onSecondCall().resolves(transaction);
        const expectedTransaction = await relayClient.relayTransaction(envelopingRequest);

        expect(selectNextRelayStub).to.be.calledTwice;
        expect(expectedTransaction).to.be.equals(transaction);
      });

      
      it('should fail to relay transaction if details are missing', async function () {
        relayClient._getEnvelopingRequestDetails = sandbox.stub().throws(new Error('missing details'));
        const expectedTransaction = relayClient.relayTransaction(envelopingRequest);

        await expect(expectedTransaction).to.be.rejectedWith('missing details')
      });

      it('should fail to relay transaction if http request cannot be prepared', async function () {
        const error = new Error('FeesReceiver has to be a valid non-zero address');
        relayClient._prepareHttpRequest = sandbox.stub().throws(error);
        const expectedTransaction = relayClient.relayTransaction(envelopingRequest);

        await expect(expectedTransaction).to.be.rejectedWith(error.message)
      });
      

      it.skip('should fail to relay transaction if there is no available relay server', async function () {
        selectNextRelayStub.resolves(undefined);
        const expectedTransaction = relayClient.relayTransaction(envelopingRequest);

        await expect(expectedTransaction).to.be.rejectedWith(NOT_RELAYED_TRANSACTION)
      });

      it.skip('should fail to relay transaction if cannot be verified locally on all servers', async function () {
        relayClient._verifyEnvelopingRequest = sandbox.stub().resolves(false);
        selectNextRelayStub.onFirstCall().resolves(relayInfo);
        selectNextRelayStub.onSecondCall().resolves(undefined);
        const expectedTransaction = relayClient.relayTransaction(envelopingRequest);

        await expect(expectedTransaction).to.be.rejectedWith(NOT_RELAYED_TRANSACTION)
      });

    });

    describe('_attemptRelayTransaction', function () {

      let httpClient: SinonStubbedInstance<HttpClient>;
      const transaction = {} as Transaction;
      let parseTransactionStub: SinonStub;
      let validateResponseStub: SinonStub;

      const relayInfo: RelayInfo = {
        hubInfo: FAKE_HUB_INFO,
        managerData: {
          url: 'fake_url'
        } as RelayManagerData
      };

      beforeEach(function () {
        httpClient = sandbox.createStubInstance(HttpClient);
        relayClient._httpClient = httpClient;
        parseTransactionStub = sandbox.stub(etherUtils, 'parse').returns(transaction);
        validateResponseStub = sandbox.stub(relayUtils, 'validateRelayResponse').returns(undefined);
        relayClient._broadcastTx = sandbox.stub().resolves(undefined);
      });

      afterEach(function () {
        sandbox.restore();
      })

      it('should return transaction if server relayed it properly', async function () {
        const expectedTransaction = await relayClient._attemptRelayTransaction(relayInfo, FAKE_RELAY_TRANSACTION_REQUEST);

        expect(expectedTransaction).to.be.equals(transaction);
      });

      it('should throw if server cannot relay transaction', async function () {
        httpClient.relayTransaction.throws('Got invalid response from relay: signedTx field missing.');
        const attempRelay = await relayClient._attemptRelayTransaction(relayInfo, FAKE_RELAY_TRANSACTION_REQUEST);

        expect(attempRelay).to.be.undefined;

      });

      it('should throw if transaction cannot be parsed', async function () {
        const error = ethersLogger.makeError('invalid arrayify value' , errors.INVALID_ARGUMENT);
        parseTransactionStub.throws(error);
        const attempRelay = await relayClient._attemptRelayTransaction(relayInfo, FAKE_RELAY_TRANSACTION_REQUEST);

        expect(attempRelay).to.be.undefined;
      });

      it('should throw if transaction cannot be validated due to transaction has no recipient address', async function () {
        validateResponseStub.throws(new Error('Transaction has no recipient address'));
        const attempRelay = await relayClient._attemptRelayTransaction(relayInfo, FAKE_RELAY_TRANSACTION_REQUEST);

        expect(attempRelay).to.be.undefined;
      });

      it(`should emit 'send-to-relayer' `, async function () {
        const emitStub = sandbox.stub();
        (relayClient as unknown as EnvelopingEventEmitter).emit = emitStub;
        await relayClient._attemptRelayTransaction(relayInfo, FAKE_RELAY_TRANSACTION_REQUEST);

        expect(emitStub).to.have.been.called;
        expect(emitStub).to.have.been.calledWith(
          envelopingEvents['send-to-relayer']
        );
      });

    });

    describe('_broadcastTx', function () {
      const fakeSignedTx = '0x01';
      let sendTransactionStub: SinonStub;

      beforeEach(function () {
        sendTransactionStub = sandbox.stub();
        providerStub.sendTransaction = sendTransactionStub;
      });

      afterEach(function () {
        sandbox.restore();
      })

      it('should send transaction if cannot find it in pool or receipt', async function () {
        providerStub.getTransaction = sandbox.stub().returns(undefined);
        providerStub.getTransactionReceipt = sandbox.stub().returns(undefined);
        await relayClient._broadcastTx(fakeSignedTx);

        expect(sendTransactionStub.called).to.be.true;
      });

      it('should not send transaction if the receipt is in the transaction pool', async function () {
        const fakeResponse = {} as TransactionResponse;
        providerStub.getTransaction = sandbox.stub().returns(Promise.resolve(fakeResponse));
        providerStub.getTransactionReceipt = sandbox.stub().returns(undefined);
        await relayClient._broadcastTx(fakeSignedTx);

        expect(sendTransactionStub.called).to.be.false;
      });

      it('should not send transaction if receipt is found', async function () {
        const fakeReceipt = {} as TransactionReceipt;
        providerStub.getTransactionReceipt = sandbox.stub().returns(Promise.resolve(fakeReceipt));
        providerStub.getTransaction = sandbox.stub().returns(undefined);
        await relayClient._broadcastTx(fakeSignedTx);

        expect(sendTransactionStub.called).to.be.false;
      });

    });

    describe('_verifyEnvelopingRequest', function () {

      beforeEach(function () {
        sandbox.stub(gasEstimator, 'estimateRelayMaxPossibleGas').returns(Promise.resolve(constants.Two));
        relayClient._verifyWorkerBalance = sandbox.stub().returns(undefined);
        relayClient._verifyWithVerifiers = sandbox.stub().returns(undefined);
        relayClient._verifyWithRelayHub = sandbox.stub().returns(undefined);
      });

      afterEach(function () {
        sandbox.restore();
      });

      it('should allow if enveloping transaction pass all verifiers', async function () {
        const verification = relayClient._verifyEnvelopingRequest(FAKE_HUB_INFO, FAKE_RELAY_TRANSACTION_REQUEST);

        await expect(verification).to.be.fulfilled;
      });

      it('should fail if enveloping transaction fails on _verifyWorkerBalance', async function () {
        const error = new Error('Worker does not have enough balance to pay');
        relayClient._verifyWorkerBalance = sandbox.stub().throws(error);
        const verification = relayClient._verifyEnvelopingRequest(FAKE_HUB_INFO, FAKE_RELAY_TRANSACTION_REQUEST);

        await expect(verification).to.be.rejectedWith(error.message);
      });

      it('should fail if enveloping transaction fails on _verifyWithVerifiers', async function () {
        const error = ethersLogger.makeError('SW different to template' , errors.CALL_EXCEPTION);
        relayClient._verifyWithVerifiers = sandbox.stub().throws(error);
        const verification = relayClient._verifyEnvelopingRequest(FAKE_HUB_INFO, FAKE_RELAY_TRANSACTION_REQUEST);

        await expect(verification).to.be.rejectedWith(error.message);
      });

      it('should fail if enveloping transaction fails on _verifyWithRelayHub', async function () {
        const error = ethersLogger.makeError('RelayWorker cannot be a contract' , errors.CALL_EXCEPTION);
        relayClient._verifyWithRelayHub = sandbox.stub().throws(error);
        const verification = relayClient._verifyEnvelopingRequest(FAKE_HUB_INFO, FAKE_RELAY_TRANSACTION_REQUEST);

        await expect(verification).to.be.rejectedWith(error.message);
      });

      it(`should emit 'validate-request' `, async function () {
        const emitStub = sandbox.stub();
        (relayClient as unknown as EnvelopingEventEmitter).emit = emitStub;
        await relayClient._verifyEnvelopingRequest(FAKE_HUB_INFO, FAKE_RELAY_TRANSACTION_REQUEST);

        expect(emitStub).to.have.been.called;
        expect(emitStub).to.have.been.calledWith(
          envelopingEvents['validate-request']
        );
      });

    });

    describe('_verifyWorkerBalance', function () {

      let relayWorkerAddress: string;
      let fakeMaxPossibleGas: BigNumber;

      beforeEach(function () {
        relayWorkerAddress = createRandomAddress();
        fakeMaxPossibleGas = BigNumber.from(10_000);
      });

      it('should succeed if worker has enough balance', async function () {
        providerStub.getBalance = sandbox.stub().returns(BigNumber.from(1_500_000));
        const verifyWorkerBalance = relayClient._verifyWorkerBalance(relayWorkerAddress, fakeMaxPossibleGas, FAKE_GAS_PRICE);

        await expect(verifyWorkerBalance).to.be.fulfilled;
      });

      it('should throw if worker has not enough balance', async function () {
        providerStub.getBalance = sandbox.stub().returns(BigNumber.from(500_000));
        const verifyWorkerBalance = relayClient._verifyWorkerBalance(relayWorkerAddress, fakeMaxPossibleGas, FAKE_GAS_PRICE);

        await expect(verifyWorkerBalance).to.be.rejectedWith('Worker does not have enough balance to pay');
      });

    });

    describe('_verifyWithVerifiers', function () {

      it('should allow if enveloping relay request will be verified', async function () {
        const callStub = sandbox.stub().returns(undefined);
        const relayVerifierStub = {
          callStatic: {
            verifyRelayedCall: callStub
          }
        } as unknown as RelayVerifier;
        sandbox.stub(RelayVerifier__factory, 'connect').returns(relayVerifierStub);
        const verifyWithVerifiers = relayClient._verifyWithVerifiers(FAKE_RELAY_TRANSACTION_REQUEST);

        expect(callStub).to.be.calledOnce;
        await expect(verifyWithVerifiers).to.be.fulfilled;
      });

      it('should allow if enveloping deploy request will be verified', async function () {
        const callStub = sandbox.stub().returns(undefined);
        const deployVerifierStub = {
          callStatic: {
            verifyRelayedCall: callStub
          }
        } as unknown as DeployVerifier;
        sandbox.stub(DeployVerifier__factory, 'connect').returns(deployVerifierStub);
        const verifyWithVerifiers = relayClient._verifyWithVerifiers(FAKE_DEPLOY_TRANSACTION_REQUEST);

        expect(callStub).to.be.calledOnce;
        await expect(verifyWithVerifiers).to.be.fulfilled;
      });

      it('should throw if enveloping relay request will not be verified due sw different to template', async function () {
        const error = ethersLogger.makeError('SW different to template' , errors.CALL_EXCEPTION);
        const callStub = sandbox.stub().throws(error);
        const relayVerifierStub = {
          callStatic: {
            verifyRelayedCall: callStub
          }
        } as unknown as RelayVerifier;
        sandbox.stub(RelayVerifier__factory, 'connect').returns(relayVerifierStub);
        const verifyWithVerifiers = relayClient._verifyWithVerifiers(FAKE_RELAY_TRANSACTION_REQUEST);

        expect(callStub).to.be.calledOnce;
        await expect(verifyWithVerifiers).to.be.rejectedWith(error.message);
      });

      it('should throw if enveloping deploy request will not be verified due to invalid factory', async function () {
        const error = ethersLogger.makeError('Invalid factory' , errors.CALL_EXCEPTION);
        const callStub = sandbox.stub().throws(error);
        const deployVerifierStub = {
          callStatic: {
            verifyRelayedCall: callStub
          }
        } as unknown as DeployVerifier;
        sandbox.stub(DeployVerifier__factory, 'connect').returns(deployVerifierStub);
        const verifyWithVerifiers = relayClient._verifyWithVerifiers(FAKE_DEPLOY_TRANSACTION_REQUEST);

        expect(callStub).to.be.calledOnce;
        await expect(verifyWithVerifiers).to.be.rejectedWith(error.message);
      });

      it('should throw if enveloping deploy request will not be verified due to address already created', async function () {
        const error = ethersLogger.makeError('Address already created!' , errors.CALL_EXCEPTION);
        const callStub = sandbox.stub().throws(error);
        const deployVerifierStub = {
          callStatic: {
            verifyRelayedCall: callStub
          }
        } as unknown as DeployVerifier;
        sandbox.stub(DeployVerifier__factory, 'connect').returns(deployVerifierStub);
        const verifyWithVerifiers = relayClient._verifyWithVerifiers(FAKE_DEPLOY_TRANSACTION_REQUEST);

        expect(callStub).to.be.calledOnce;
        await expect(verifyWithVerifiers).to.be.rejectedWith(error.message);
      });

      it('should throw if enveloping request will not be verified due to token contract not allowed', async function () {
        const error = ethersLogger.makeError('Token contract not allowed' , errors.CALL_EXCEPTION);
        const callStub = sandbox.stub().throws(error);
        const deployVerifierStub = {
          callStatic: {
            verifyRelayedCall: callStub
          }
        } as unknown as DeployVerifier;
        sandbox.stub(DeployVerifier__factory, 'connect').returns(deployVerifierStub);
        const verifyWithVerifiers = relayClient._verifyWithVerifiers(FAKE_DEPLOY_TRANSACTION_REQUEST);

        expect(callStub).to.be.calledOnce;
        await expect(verifyWithVerifiers).to.be.rejectedWith(error.message);
      });

      it('should throw if enveloping request will not be verified due to balance too low', async function () {
        const error = ethersLogger.makeError('balance too low' , errors.CALL_EXCEPTION);
        const callStub = sandbox.stub().throws(error);
        const deployVerifierStub = {
          callStatic: {
            verifyRelayedCall: callStub
          }
        } as unknown as DeployVerifier;
        sandbox.stub(DeployVerifier__factory, 'connect').returns(deployVerifierStub);
        const verifyWithVerifiers = relayClient._verifyWithVerifiers(FAKE_DEPLOY_TRANSACTION_REQUEST);

        expect(callStub).to.be.calledOnce;
        await expect(verifyWithVerifiers).to.be.rejectedWith(error.message);
      });

    });

    describe('_verifyWithRelayHub', function () {

      let relayWorkerAddress: string;
      let fakeMaxPossibleGas: BigNumber;
      let relayHubStub: Sinon.SinonStubbedInstance<RelayHub>;

      beforeEach(function () {
        relayWorkerAddress = createRandomAddress();
        fakeMaxPossibleGas = createRandomBigNumber(10000);
      });

      it('should allow if enveloping relay request will succeed', async function () {
        const callStub = sandbox.stub().returns(undefined);
        relayHubStub = {
          callStatic: {
            relayCall: callStub
          }
        } as unknown as typeof relayHubStub;
        sandbox.stub(RelayHub__factory, 'connect').returns(relayHubStub);
        const verifyWithRelayHub = relayClient._verifyWithRelayHub(relayWorkerAddress, FAKE_RELAY_TRANSACTION_REQUEST, fakeMaxPossibleGas);

        expect(callStub).to.be.calledOnce;
        await expect(verifyWithRelayHub).to.be.fulfilled;
      });

      it('should allow if enveloping deploy request will succeed', async function () {
        const callStub = sandbox.stub().returns(undefined);
        relayHubStub = {
          callStatic: {
            deployCall: callStub
          }
        } as unknown as typeof relayHubStub;
        sandbox.stub(RelayHub__factory, 'connect').returns(relayHubStub);
        const verifyWithRelayHub = relayClient._verifyWithRelayHub(relayWorkerAddress, FAKE_DEPLOY_TRANSACTION_REQUEST, fakeMaxPossibleGas);

        expect(callStub).to.be.calledOnce;
        await expect(verifyWithRelayHub).to.be.fulfilled;
      });

      it('should throw if enveloping request will fail due to not enabled worker', async function () {
        const error = ethersLogger.makeError('Not an enabled worker' , errors.CALL_EXCEPTION);
        const callStub = sandbox.stub().throws(error);
        relayHubStub = {
          callStatic: {
            relayCall: callStub
          }
        } as unknown as typeof relayHubStub;
        sandbox.stub(RelayHub__factory, 'connect').returns(relayHubStub);
        const verifyWithRelayHub = relayClient._verifyWithRelayHub(relayWorkerAddress, FAKE_RELAY_TRANSACTION_REQUEST, fakeMaxPossibleGas);

        expect(callStub).to.be.calledOnce;
        await expect(verifyWithRelayHub).to.be.rejectedWith(error.message);
      });
      
      it('should throw if enveloping request will fail due to invalid gas price', async function () {
        const error = ethersLogger.makeError('Invalid gas price' , errors.CALL_EXCEPTION);
        const callStub = sandbox.stub().throws(error);
        relayHubStub = {
          callStatic: {
            relayCall: callStub
          }
        } as unknown as typeof relayHubStub;
        sandbox.stub(RelayHub__factory, 'connect').returns(relayHubStub);
        const verifyWithRelayHub = relayClient._verifyWithRelayHub(relayWorkerAddress, FAKE_RELAY_TRANSACTION_REQUEST, fakeMaxPossibleGas);

        expect(callStub).to.be.calledOnce;
        await expect(verifyWithRelayHub).to.be.rejectedWith(error.message);
      });

      it('should throw if enveloping request will fail due to the relayWorker cannot be a contract', async function () {
        const error = ethersLogger.makeError('RelayWorker cannot be a contract' , errors.CALL_EXCEPTION);
        const callStub = sandbox.stub().throws(error);
        relayHubStub = {
          callStatic: {
            relayCall: callStub
          }
        } as unknown as typeof relayHubStub;
        sandbox.stub(RelayHub__factory, 'connect').returns(relayHubStub);
        const verifyWithRelayHub = relayClient._verifyWithRelayHub(relayWorkerAddress, FAKE_RELAY_TRANSACTION_REQUEST, fakeMaxPossibleGas);

        expect(callStub).to.be.calledOnce;
        await expect(verifyWithRelayHub).to.be.rejectedWith(error.message);
      });

    });
  });
});
