import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BigNumber, constants, providers, Transaction, Wallet } from 'ethers';
import sinon, { SinonStub } from 'sinon';
import sinonChai from 'sinon-chai';
import {
  EnvelopingTypes,
  ICustomSmartWalletFactory,
  ICustomSmartWalletFactory__factory,
  IERC20,
  IERC20__factory,
  ISmartWalletFactory,
  ISmartWalletFactory__factory,
  RelayHub,
  RelayHub__factory,
} from '@rsksmart/rif-relay-contracts';
import type { EnvelopingConfig } from '../src/common/config.types';
import {
  estimateInternalCallGas,
  estimateTokenTransferGas,
  getSmartWalletAddress,
  INTERNAL_TRANSACTION_ESTIMATED_CORRECTION,
  useEnveloping,
  validateRelayResponse,
  getRelayClientGenerator,
} from '../src/utils';
import { FAKE_ENVELOPING_CONFIG } from './config.fakes';
import {
  FAKE_DEPLOY_REQUEST,
  FAKE_DEPLOY_TRANSACTION_REQUEST,
  FAKE_RELAY_REQUEST,
  FAKE_RELAY_TRANSACTION_REQUEST,
  FAKE_REQUEST_CONFIG,
} from './request.fakes';
import * as clientConfiguration from '../src/common/clientConfigurator';
import type { TokenGasEstimationParams } from '../src/common';
import {
  MISSING_SMART_WALLET_ADDRESS,
  MISSING_CALL_FORWARDER,
} from '../src/constants/errorMessages';
import { createRandomeValue } from './utils';
import type { RelayClient } from 'src';

use(sinonChai);
use(chaiAsPromised);

const createRandomAddress = () => Wallet.createRandom().address;

describe('utils', function () {
  const preferredRelays: EnvelopingConfig['preferredRelays'] = [
    'https://first.relay.co',
    'http://second.relay.co',
    'http://third.relay.co',
  ];

  beforeEach(function () {
    sinon.replace(clientConfiguration, 'getEnvelopingConfig', () => {
      return {
        ...FAKE_ENVELOPING_CONFIG,
        preferredRelays,
      };
    });
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('estimateInternalCallGas', function () {
    let relayRequest: EnvelopingTypes.RelayRequestStruct;
    let providerStub: providers.Provider;

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
      providerStub = sinon.createStubInstance(providers.Provider);
      sinon.stub(clientConfiguration, 'getProvider').returns(providerStub);
    });

    it('should return the estimation applying the internal correction', async function () {
      const estimateGas = BigNumber.from(10000);
      providerStub.estimateGas = sinon.stub().resolves(estimateGas);
      const internalEstimationCorrection = 5000;
      const estimation = await estimateInternalCallGas({
        data: relayRequest.request.data,
        from: relayRequest.request.from,
        to: relayRequest.request.to,
        gasPrice: relayRequest.relayData.gasPrice,
        internalEstimationCorrection,
      });
      const expectedEstimation = estimateGas.sub(internalEstimationCorrection);

      expect(estimation.toString()).to.be.equal(expectedEstimation.toString());
    });

    it('should return the estimation without applying the internal correction', async function () {
      const expectedGasEst = BigNumber.from(4000);
      providerStub.estimateGas = sinon.stub().resolves(expectedGasEst);
      const internalEstimationCorrection = 5000;
      const actualGasEst = await estimateInternalCallGas({
        data: relayRequest.request.data,
        from: relayRequest.request.from,
        to: relayRequest.request.to,
        gasPrice: relayRequest.relayData.gasPrice,
        internalEstimationCorrection,
      });

      expect(actualGasEst.toString()).to.be.equal(expectedGasEst.toString());
    });

    it('should return estimation without applying gas correction factor when addExternalCorrection is set to false', async function () {
      const estimateGas = BigNumber.from(10000);
      providerStub.estimateGas = sinon.stub().resolves(estimateGas);
      const internalEstimationCorrection = 5000;
      const estimation = await estimateInternalCallGas({
        data: relayRequest.request.data,
        from: relayRequest.request.from,
        to: relayRequest.request.to,
        gasPrice: relayRequest.relayData.gasPrice,
        internalEstimationCorrection,
        estimatedGasCorrectionFactor: '1',
      });
      const expectedEstimation = estimateGas.sub(internalEstimationCorrection);

      expect(estimation.toString()).to.be.equal(expectedEstimation.toString());
    });

    it('should return estimation applying gas correction factor when estimatedGasCorrectionFactor different from 1', async function () {
      const expectedEstimation = BigNumber.from(7_500);
      providerStub.estimateGas = sinon.stub().resolves(BigNumber.from(10_000));
      const internalEstimationCorrection = 5_000;
      const estimation = await estimateInternalCallGas({
        data: relayRequest.request.data,
        from: relayRequest.request.from,
        to: relayRequest.request.to,
        gasPrice: relayRequest.relayData.gasPrice,
        internalEstimationCorrection,
        estimatedGasCorrectionFactor: '1.5',
      });

      expect(estimation.toString()).to.be.equal(expectedEstimation.toString());
    });
  });

  describe('estimateTokenTransferGas', function () {
    let ierc20TransferStub: SinonStub;

    beforeEach(function () {
      ierc20TransferStub = sinon.stub();
      const estimateGas = {
        transfer: ierc20TransferStub,
      };

      const ierc20Stub = {
        estimateGas,
      } as unknown as sinon.SinonStubbedInstance<IERC20>;

      sinon.stub(IERC20__factory, 'connect').returns(ierc20Stub);
    });

    it('should return 0 if token contract is zero address', async function () {
      const request: TokenGasEstimationParams = {
        relayRequest: {
          ...FAKE_RELAY_REQUEST,
          request: {
            ...FAKE_RELAY_REQUEST.request,
            tokenContract: constants.AddressZero,
          },
        },
        ...FAKE_REQUEST_CONFIG,
      };

      expect((await estimateTokenTransferGas(request)).toString()).to.be.equal(
        BigNumber.from(0).toString()
      );
    });

    it('should return 0 if token amount is 0', async function () {
      const request: TokenGasEstimationParams = {
        relayRequest: {
          ...FAKE_RELAY_REQUEST,
          request: {
            ...FAKE_RELAY_REQUEST.request,
            tokenAmount: constants.Zero,
          },
        },
        ...FAKE_REQUEST_CONFIG,
      };

      expect((await estimateTokenTransferGas(request)).toString()).to.be.equal(
        constants.Zero.toString()
      );
    });

    it('should fail if it is a deploy and the smartWallet is missing', async function () {
      const request: TokenGasEstimationParams = {
        relayRequest: { ...FAKE_DEPLOY_REQUEST },
        preDeploySWAddress: undefined,
      };

      await expect(estimateTokenTransferGas(request)).to.be.rejectedWith(
        MISSING_SMART_WALLET_ADDRESS
      );
    });

    it('should fail if it is a deploy and the smartWallet is the zero address', async function () {
      const request: TokenGasEstimationParams = {
        relayRequest: { ...FAKE_DEPLOY_REQUEST },
        preDeploySWAddress: constants.AddressZero,
      };

      await expect(estimateTokenTransferGas(request)).to.be.rejectedWith(
        MISSING_SMART_WALLET_ADDRESS
      );
    });

    it('should fail if it is a relay transaction and the callForwarder is missing', async function () {
      const request: TokenGasEstimationParams = {
        relayRequest: {
          ...FAKE_RELAY_REQUEST,
          relayData: {
            ...FAKE_RELAY_REQUEST.relayData,
            callForwarder: constants.AddressZero,
          },
        },
        preDeploySWAddress: constants.AddressZero,
      };

      await expect(estimateTokenTransferGas(request)).to.be.rejectedWith(
        MISSING_CALL_FORWARDER
      );
    });

    it('should correct the value of the estimation when the gas cost is greater than the correction', async function () {
      const FAKE_GAS_COST = 30000;
      const INTERNAL_CORRECTION = 20000;
      const EXPECTED_ESTIMATION = FAKE_GAS_COST - INTERNAL_CORRECTION;

      const request: TokenGasEstimationParams = {
        relayRequest: {
          ...FAKE_RELAY_REQUEST,
          relayData: {
            ...FAKE_RELAY_REQUEST.relayData,
            gasPrice: FAKE_GAS_COST,
          },
        },
        internalEstimationCorrection: INTERNAL_CORRECTION,
      };

      ierc20TransferStub.resolves(BigNumber.from(FAKE_GAS_COST));

      const estimation = await estimateTokenTransferGas(request);

      expect(estimation.toString()).to.equal(EXPECTED_ESTIMATION.toString());
    });

    it('should not correct the value of the estimation when the gas cost is lower than the correction', async function () {
      const FAKE_GAS_COST = 10000;
      const INTERNAL_CORRECTION = 20000;
      const EXPECTED_ESTIMATION = FAKE_GAS_COST;

      ierc20TransferStub.resolves(BigNumber.from(FAKE_GAS_COST));

      const request: TokenGasEstimationParams = {
        relayRequest: {
          ...FAKE_RELAY_REQUEST,
          relayData: {
            ...FAKE_RELAY_REQUEST.relayData,
            gasPrice: FAKE_GAS_COST,
          },
        },
        internalEstimationCorrection: INTERNAL_CORRECTION,
      };

      const estimation = await estimateTokenTransferGas(request);

      expect(estimation.toString()).to.equal(EXPECTED_ESTIMATION.toString());
    });

    it('should apply the correction factor', async function () {
      const FAKE_GAS_COST = 10000;
      const INTERNAL_CORRECTION = 20000;
      const CORRECTION_FACTOR = 1.5;
      const EXPECTED_ESTIMATION = FAKE_GAS_COST * CORRECTION_FACTOR;

      ierc20TransferStub.resolves(BigNumber.from(FAKE_GAS_COST));

      const request: TokenGasEstimationParams = {
        relayRequest: {
          ...FAKE_RELAY_REQUEST,
          relayData: {
            ...FAKE_RELAY_REQUEST.relayData,
            gasPrice: FAKE_GAS_COST,
          },
        },
        internalEstimationCorrection: INTERNAL_CORRECTION,
        estimatedGasCorrectionFactor: CORRECTION_FACTOR,
      };

      const estimation = await estimateTokenTransferGas(request);

      expect(estimation.toString()).to.equal(EXPECTED_ESTIMATION.toString());
    });

    it('should use by-default values when not sent as parameters', async function () {
      //Just to be sure that the gas cost is lower than the estimate correction
      const FAKE_GAS_COST = INTERNAL_TRANSACTION_ESTIMATED_CORRECTION - 1;
      const EXPECTED_ESTIMATION = FAKE_GAS_COST;

      ierc20TransferStub.resolves(BigNumber.from(FAKE_GAS_COST));

      const request: TokenGasEstimationParams = {
        relayRequest: {
          ...FAKE_RELAY_REQUEST,
          relayData: {
            ...FAKE_RELAY_REQUEST.relayData,
            gasPrice: FAKE_GAS_COST,
          },
        },
      };

      const estimation = await estimateTokenTransferGas(request);

      expect(estimation.toString()).to.equal(EXPECTED_ESTIMATION.toString());
    });
  });

  describe('getSmartWalletAddress', function () {
    let owner: string;
    let index: string;

    beforeEach(function () {
      owner = createRandomAddress();
      index = createRandomeValue(1000);
    });

    afterEach(function () {
      sinon.restore();
    });

    it('should return SW address', async function () {
      const expectedAddress = createRandomAddress();
      const factoryStub = {
        getSmartWalletAddress: () => expectedAddress,
      } as unknown as ISmartWalletFactory;
      sinon.stub(ISmartWalletFactory__factory, 'connect').returns(factoryStub);
      const address = await getSmartWalletAddress(owner, index);

      expect(address).to.be.equals(expectedAddress);
    });

    it('should custom return SW address', async function () {
      const expectedAddress = createRandomAddress();
      const factoryStub = {
        getSmartWalletAddress: () => expectedAddress,
      } as unknown as ICustomSmartWalletFactory;
      sinon
        .stub(ICustomSmartWalletFactory__factory, 'connect')
        .returns(factoryStub);
      const logic = createRandomAddress();
      const address = await getSmartWalletAddress(
        owner,
        index,
        undefined,
        logic,
        '0x0'
      );

      expect(address).to.be.equals(expectedAddress);
    });
  });

  describe('validateRelayResponse', function () {
    let relayWorkerAddress: string;
    let relayHubAddress: string;

    beforeEach(function () {
      relayWorkerAddress = createRandomAddress();
      relayHubAddress = FAKE_ENVELOPING_CONFIG.relayHubAddress;

      const encodeFunctionDataStub = sinon.stub();

      encodeFunctionDataStub
        .withArgs('relayCall', sinon.match.any)
        .returns('Dummy Relay Data');
      encodeFunctionDataStub
        .withArgs('deployCall', sinon.match.any)
        .returns('Dummy Deploy Data');
      const relayHubStub = {
        interface: {
          encodeFunctionData: encodeFunctionDataStub,
        },
      } as unknown as RelayHub;
      sinon.stub(RelayHub__factory, 'connect').returns(relayHubStub);
    });

    afterEach(function () {
      sinon.restore();
    });

    it('Should perform checks on relay transaction and not throw errors', function () {
      const transaction: Transaction = {
        nonce: BigNumber.from(
          FAKE_RELAY_TRANSACTION_REQUEST.metadata.relayMaxNonce
        ).toNumber(),
        chainId: 33,
        data: 'Dummy Relay Data',
        gasLimit: constants.Zero,
        value: constants.Zero,
        to: relayHubAddress,
        from: relayWorkerAddress,
      };

      expect(() =>
        validateRelayResponse(
          FAKE_RELAY_TRANSACTION_REQUEST,
          transaction,
          relayWorkerAddress
        )
      ).to.not.throw();
    });

    it('Should throw error if transaction has no recipient address', function () {
      const transaction: Transaction = {
        nonce: 7,
        chainId: 33,
        data: 'Dummy Deploy Data',
        gasLimit: constants.Zero,
        value: constants.Zero,
        to: undefined,
        from: relayWorkerAddress,
      };

      expect(() =>
        validateRelayResponse(
          FAKE_DEPLOY_TRANSACTION_REQUEST,
          transaction,
          relayWorkerAddress
        )
      ).to.throw(`Transaction has no recipient address`);
    });

    it('Should throw error if transaction has no sender address', function () {
      const transaction: Transaction = {
        nonce: 7,
        chainId: 33,
        data: 'Dummy Deploy Data',
        gasLimit: constants.Zero,
        value: constants.Zero,
        to: relayHubAddress,
        from: undefined,
      };

      expect(() =>
        validateRelayResponse(
          FAKE_DEPLOY_TRANSACTION_REQUEST,
          transaction,
          relayWorkerAddress
        )
      ).to.throw(`Transaction has no signer`);
    });

    it('Should throw error if nonce is greater than relayMaxNonce', function () {
      const transaction: Transaction = {
        nonce: 7,
        chainId: 33,
        data: 'Dummy Deploy Data',
        gasLimit: constants.Zero,
        value: constants.Zero,
        to: relayHubAddress,
        from: relayWorkerAddress,
      };

      const {
        metadata: { relayMaxNonce },
      } = FAKE_DEPLOY_TRANSACTION_REQUEST;

      expect(() =>
        validateRelayResponse(
          FAKE_DEPLOY_TRANSACTION_REQUEST,
          transaction,
          relayWorkerAddress
        )
      ).to.throw(
        `Relay used a tx nonce higher than requested. Requested ${relayMaxNonce.toString()} got ${
          transaction.nonce
        }`
      );
    });

    it('Should throw error if Transaction recipient is not the RelayHubAddress', function () {
      const transaction: Transaction = {
        nonce: 2,
        chainId: 33,
        data: 'Dummy Deploy Data',
        gasLimit: constants.Zero,
        value: constants.Zero,
        to: 'Dummy Address',
        from: relayWorkerAddress,
      };

      expect(() =>
        validateRelayResponse(
          FAKE_DEPLOY_TRANSACTION_REQUEST,
          transaction,
          relayWorkerAddress
        )
      ).to.throw(`Transaction recipient must be the RelayHubAddress`);
    });

    it('Should throw error if Relay request Encoded data is not the same as Transaction data', function () {
      const transaction: Transaction = {
        nonce: 2,
        chainId: 33,
        data: 'Dummy Different Data',
        gasLimit: constants.Zero,
        value: constants.Zero,
        to: relayHubAddress,
        from: relayWorkerAddress,
      };

      expect(() =>
        validateRelayResponse(
          FAKE_DEPLOY_TRANSACTION_REQUEST,
          transaction,
          relayWorkerAddress
        )
      ).to.throw(
        `Relay request Encoded data must be the same as Transaction data`
      );
    });

    it('Should throw error if Relay Worker is not the same as Transaction sender', function () {
      const transaction: Transaction = {
        nonce: 2,
        chainId: 33,
        data: 'Dummy Deploy Data',
        gasLimit: constants.Zero,
        value: constants.Zero,
        to: relayHubAddress,
        from: 'Dummy Address',
      };

      expect(() =>
        validateRelayResponse(
          FAKE_DEPLOY_TRANSACTION_REQUEST,
          transaction,
          relayWorkerAddress
        )
      ).to.throw(
        `Transaction sender address must be the same as configured relayWorker address`
      );
    });
  });

  describe('useEnveloping', function () {
    it('Should return true if method is eth_accounts', function () {
      expect(useEnveloping('eth_accounts', [])).to.be.true;
    });

    it('Should return false if params is empty', function () {
      expect(useEnveloping('eth_other', [])).to.be.false;
    });

    it('Should return true if params contains envelopingTx, requestConfig and requestConfig.useEnveloping is true', function () {
      const result = useEnveloping('eth_sendTransaction', [
        {
          envelopingTx: FAKE_RELAY_REQUEST,
          requestConfig: {
            useEnveloping: true,
          },
        },
      ]);

      expect(result).to.be.true;
    });
  });

  describe('getRelayClientGenerator', function () {
    let relayGenerator: Generator<RelayClient, void, unknown>;

    beforeEach(function () {
      relayGenerator = getRelayClientGenerator();
    });

    it('Should iterate the list of preferred relays and return a preconfigured RelayClient instance each time', function () {
      for (let i = 0; i < preferredRelays.length; i++) {
        const nextRelayClient = relayGenerator.next().value as RelayClient;

        expect(nextRelayClient.getRelayServerUrl()).equal(preferredRelays[i]);
      }
    });

    it('Should return done = false if there are more relays in the list', function () {
      for (let i = 0; i < preferredRelays.length - 1; i++) {
        const next = relayGenerator.next();

        expect(next.done).equal(false);
      }
    });

    it('Should return done = true if the list of relays has reached the end', function () {
      for (let i = 0; i < preferredRelays.length; i++) {
        relayGenerator.next();
      }

      const next = relayGenerator.next();

      expect(next.done).equal(true);
    });
  });
});
