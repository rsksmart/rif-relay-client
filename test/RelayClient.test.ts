import type {
  EnvelopingConfig,
  EnvelopingTransactionDetails,
} from '@rsksmart/rif-relay-common';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { createSandbox, SinonStubbedInstance } from 'sinon';
import sinonChai from 'sinon-chai';
import { RelayClient } from '../src/RelayClient';
import { createRandomAddress } from './utils';
import { providers, BigNumber } from 'ethers';

use(sinonChai);
use(chaiAsPromised);

const sandbox = createSandbox();

describe('RelayClient', function () {
  describe('constructor', function () {
    afterEach(function () {
      sandbox.restore();
    });

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

    it('should store envelopingConfig', function () {
      const expectedEnvelopingConfig = {} as EnvelopingConfig;
      const relayClient = new RelayClient();
      (
        relayClient as unknown as {
          _envelopingConfig: EnvelopingConfig;
        }
      )._envelopingConfig = expectedEnvelopingConfig;
      expect(relayClient).to.be.instanceOf(RelayClient);
      expect(
        (relayClient as unknown as { _envelopingConfig: EnvelopingConfig })
          ._envelopingConfig,
        'Provider'
      ).to.equal(expectedEnvelopingConfig);
    });
  });

  describe('getInternalGasEstimation', function () {
    let provider: SinonStubbedInstance<providers.BaseProvider>;
    let relayClient: RelayClient;
    let transactionDetails: EnvelopingTransactionDetails;

    beforeEach(function () {
      transactionDetails = {
        from: createRandomAddress(),
        to: createRandomAddress(),
        data: '0x01',
      };
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
        transactionDetails,
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
        transactionDetails,
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
        transactionDetails,
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
        transactionDetails,
        internalGasCorrection
      );
      expect(estimation.toString()).to.be.equal(expectedEstimation.toString());
      expect(stubApplyGasCorrection.calledOnce).to.be.true;
    });

    /*  it('should truncate internalGasCorrection while doing estimation', async function(){
            const estimateGas = BigNumber.from(4000);
            provider.estimateGas.returns(Promise.resolve(estimateGas));
            const internalGasCorrection = 5000;
            const estimaton = await relayClient.estimateInternalCallGas(transactionDetails, internalGasCorrection);
            const expectedEstimation = estimateGas;
            expect(estimaton.toString()).to.be.equal(expectedEstimation.toString());
        }); */
  });

  describe('_calculateGasPrice', function () {
    let provider: SinonStubbedInstance<providers.BaseProvider>;
    let relayClient: RelayClient;
    let envelopingConfig: EnvelopingConfig;

    beforeEach(function () {
      envelopingConfig = {
        chainId: 33,
        clientId: '',
        deployVerifierAddress: '',
        forwarderAddress: '',
        gasPriceFactorPercent: 20,
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
      relayClient = new RelayClient();
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

    afterEach(function () {
      sandbox.restore();
    });

    it('should return minGasPrice', async function () {
      const estimateGas = BigNumber.from(10000);
      provider.getGasPrice.returns(Promise.resolve(estimateGas));
      const gasPrice = await relayClient['_calculateGasPrice']();
      expect(gasPrice.toString()).to.be.equal(
        envelopingConfig.minGasPrice.toString()
      );
    });

    it('should return gas price with factor', async function () {
      const estimateGas = BigNumber.from(60000);
      provider.getGasPrice.returns(Promise.resolve(estimateGas));
      const gasPrice = await relayClient['_calculateGasPrice']();
      const bigGasPriceFactorPercent = BigNumber.from(
        envelopingConfig.gasPriceFactorPercent
      );
      const estimatedGas = estimateGas
        .mul(bigGasPriceFactorPercent.add(100))
        .div(100);
      expect(gasPrice.toString()).to.be.equal(estimatedGas.toString());
    });
  });
});
