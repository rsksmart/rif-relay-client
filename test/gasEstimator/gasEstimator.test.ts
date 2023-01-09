import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { createSandbox, SinonStubbedInstance } from 'sinon';
import { BigNumber, providers, Wallet } from 'ethers';
import { RelayHub, RelayHub__factory } from '@rsksmart/rif-relay-contracts';
import { BigNumber as BigNumberJs } from 'bignumber.js';

import {
  FAKE_DEPLOY_REQUEST,
  FAKE_DEPLOY_TRANSACTION_REQUEST,
  FAKE_RELAY_REQUEST,
  FAKE_RELAY_TRANSACTION_REQUEST,
} from '../request.fakes';
import { estimateRelayMaxPossibleGas } from '../../src/gasEstimator/gasEstimator';
import type { EnvelopingTxRequest } from '../../src/common/relayTransaction.types';
import type { EnvelopingMetadata } from '../../src/common/relayHub.types';
import {
  estimateMaxPossibleWithLinearFit,
  linearFitMaxPossibleGasEstimation,
  standardMaxPossibleGasEstimation,
} from '../../src/gasEstimator/utils';
import { ESTIMATED_GAS_CORRECTION_FACTOR } from '../../src/utils';
import RelayClient from '../../src/RelayClient';

import * as gasEstimatorUtils from '../../src/gasEstimator/utils';
import * as clientConfiguration from '../../src/common/clientConfigurator';
import { createRandomAddress } from '../utils';

use(sinonChai);
use(chaiAsPromised);

const sandbox = createSandbox();

const randomBigNumber = (max: number) =>
  BigNumber.from((Math.random() * max).toFixed(0));

describe('GasEstimator', function () {
  afterEach(function () {
    sandbox.restore();
  });

  describe('estimateMaxPossibleGas', function () {
    let fakeTokenGas: BigNumber;
    let fakeDeployEstimation: BigNumber;
    let fakeRelayEstimation: BigNumber;
    let fakeFitRelayEstimation: BigNumber;
    let relayWorker: string;

    beforeEach(function () {
      fakeTokenGas = randomBigNumber(10000);
      fakeDeployEstimation = randomBigNumber(10000);
      fakeRelayEstimation = randomBigNumber(10000);
      fakeFitRelayEstimation = randomBigNumber(10000);
      relayWorker = Wallet.createRandom().address;
      sandbox
        .stub(RelayClient.prototype, 'estimateTokenTransferGas')
        .returns(Promise.resolve(fakeTokenGas));
      sandbox
        .stub(RelayClient.prototype, 'getSmartWalletAddress')
        .returns(Promise.resolve(createRandomAddress()));
    });

    afterEach(function () {
      sandbox.restore();
    });

    it('should estimate the relay transaction(standard)', async function () {
      sandbox
        .stub(gasEstimatorUtils, 'standardMaxPossibleGasEstimation')
        .returns(Promise.resolve(fakeRelayEstimation));

      const estimation = await estimateRelayMaxPossibleGas(
        FAKE_RELAY_TRANSACTION_REQUEST,
        relayWorker
      );

      expect(
        estimation.eq(fakeRelayEstimation),
        `${estimation.toString()} should equal ${fakeRelayEstimation.toString()}`
      ).to.be.true;
    });

    it('should estimate the deploy transaction(standard)', async function () {
      sandbox
        .stub(gasEstimatorUtils, 'standardMaxPossibleGasEstimation')
        .returns(Promise.resolve(fakeDeployEstimation));

      const estimation = await estimateRelayMaxPossibleGas(
        FAKE_DEPLOY_TRANSACTION_REQUEST,
        relayWorker
      );

      expect(
        estimation.eq(fakeDeployEstimation),
        `${estimation.toString()} should equal ${fakeDeployEstimation.toString()}`
      ).to.be.true;
    });

    it('should estimate the relay transaction(linearFit)', async function () {
      sandbox
        .stub(gasEstimatorUtils, 'linearFitMaxPossibleGasEstimation')
        .returns(Promise.resolve(fakeFitRelayEstimation));

      const relayTransaction: EnvelopingTxRequest = {
        ...FAKE_RELAY_TRANSACTION_REQUEST,
        metadata: {
          signature: '0',
        } as EnvelopingMetadata,
      };

      const estimation = await estimateRelayMaxPossibleGas(
        relayTransaction,
        relayWorker
      );

      expect(
        estimation.eq(fakeFitRelayEstimation),
        `${estimation.toString()} should equal ${fakeFitRelayEstimation.toString()}`
      ).to.be.true;
    });

    it('should estimate the deploy transaction(linearFit)', async function () {
      const error = 'LinearFit estimation not implemented for deployments';

      const relayTransaction: EnvelopingTxRequest = {
        ...FAKE_DEPLOY_TRANSACTION_REQUEST,
        metadata: {
          signature: '0',
        } as EnvelopingMetadata,
      };

      const estimation = estimateRelayMaxPossibleGas(
        relayTransaction,
        relayWorker
      );

      await expect(estimation).to.be.rejectedWith(error);
    });
  });

  describe('standardMaxPossibleGasEstimation', function () {
    let fakeTokenGas: BigNumber;
    let fakeDeployGas: BigNumber;
    let fakeRelayGas: BigNumber;
    let relayWorker: string;
    let providerStub: SinonStubbedInstance<providers.BaseProvider>;
    let relayHubStub: SinonStubbedInstance<RelayHub>;

    beforeEach(function () {
      fakeTokenGas = randomBigNumber(10000);
      fakeDeployGas = randomBigNumber(10000);
      fakeRelayGas = randomBigNumber(10000);
      relayWorker = Wallet.createRandom().address;
      providerStub = sandbox.createStubInstance(providers.BaseProvider);
      sandbox.stub(clientConfiguration, 'getProvider').returns(providerStub);

      relayHubStub = {
        populateTransaction: {
          deployCall: sandbox.stub(),
          relayCall: sandbox.stub(),
        },
      } as unknown as typeof relayHubStub;

      sandbox.stub(RelayHub__factory, 'connect').returns(relayHubStub);
    });

    afterEach(function () {
      sandbox.restore();
    });

    it('should estimate the relay transaction', async function () {
      providerStub.estimateGas.returns(Promise.resolve(fakeRelayGas));

      const estimation = await standardMaxPossibleGasEstimation(
        FAKE_RELAY_TRANSACTION_REQUEST,
        relayWorker,
        fakeTokenGas
      );

      const relayEstimation = fakeTokenGas.add(fakeRelayGas);

      expect(
        estimation.eq(relayEstimation),
        `${estimation.toString()} should equal ${relayEstimation.toString()}`
      ).to.be.true;
    });

    it('should estimate the deploy transaction', async function () {
      providerStub.estimateGas.returns(Promise.resolve(fakeDeployGas));

      const estimation = await standardMaxPossibleGasEstimation(
        FAKE_DEPLOY_TRANSACTION_REQUEST,
        relayWorker,
        fakeTokenGas
      );
      const relayEstimation = fakeTokenGas.add(fakeDeployGas);

      expect(
        estimation.eq(relayEstimation),
        `${estimation.toString()} should equal ${relayEstimation.toString()}`
      ).to.be.true;
    });
  });

  describe('linearFitMaxPossibleGasEstimation', function () {
    let fakeTokenGas: BigNumber;

    beforeEach(function () {
      fakeTokenGas = randomBigNumber(10000);
    });

    afterEach(function () {
      sandbox.restore();
    });

    it('should fail to estimate a deploy transaction', async function () {
      const estimation = linearFitMaxPossibleGasEstimation(
        FAKE_DEPLOY_REQUEST,
        fakeTokenGas
      );

      await expect(estimation).to.be.rejectedWith(
        'LinearFit estimation not implemented for deployments'
      );
    });

    it('should estimate the relay transaction', async function () {
      const internalGas = randomBigNumber(10000);

      sandbox
        .stub(RelayClient.prototype, 'estimateInternalCallGas')
        .returns(Promise.resolve(internalGas));

      const estimation = await linearFitMaxPossibleGasEstimation(
        FAKE_RELAY_REQUEST,
        fakeTokenGas
      );

      const expectedEstimation = estimateMaxPossibleWithLinearFit(
        internalGas,
        fakeTokenGas
      );

      expect(
        estimation.eq(expectedEstimation),
        `${estimation.toString()} should equal ${expectedEstimation.toString()}`
      ).to.be.true;
    });
  });

  describe('estimateMaxPossibleWithLinearFit', function () {
    it('should estimate a subsidized case', function () {
      const relayCallGasLimit = 40000;
      const tokenPaymentGas = 0;
      const estimatedGasCorrectionFactor = 1;
      const A0 = BigNumberJs('85090.977');
      const A1 = BigNumberJs('1.067');
      const expectedCost = A1.multipliedBy(relayCallGasLimit).plus(A0);

      const actualCost = estimateMaxPossibleWithLinearFit(
        relayCallGasLimit,
        tokenPaymentGas,
        estimatedGasCorrectionFactor
      );

      expect(actualCost.toString()).to.equal(expectedCost.toFixed(0));
    });

    it('should estimate a not subsidized case', function () {
      const relayCallGasLimit = 40000;
      const tokenPaymentGas = 5000;
      const estimatedGasCorrectionFactor = 1;
      const A0 = BigNumberJs('72530.9611');
      const A1 = BigNumberJs('1.1114');
      const expectedCost = A1.multipliedBy(
        BigNumberJs(relayCallGasLimit).plus(tokenPaymentGas)
      ).plus(A0);

      const actualCost = estimateMaxPossibleWithLinearFit(
        relayCallGasLimit,
        tokenPaymentGas,
        estimatedGasCorrectionFactor
      );

      expect(actualCost.toString()).to.equal(expectedCost.toFixed(0));
    });

    it('should apply gas correction factor', function () {
      const relayCallGasLimit = 40000;
      const tokenPaymentGas = 5000;
      const estimatedGasCorrectionFactor = 1.5;
      const A0 = BigNumberJs('72530.9611');
      const A1 = BigNumberJs('1.1114');
      let expectedCost = A1.multipliedBy(
        BigNumberJs(relayCallGasLimit).plus(tokenPaymentGas)
      ).plus(A0);
      expectedCost = expectedCost.multipliedBy(estimatedGasCorrectionFactor);

      const actualCost = estimateMaxPossibleWithLinearFit(
        relayCallGasLimit,
        tokenPaymentGas,
        estimatedGasCorrectionFactor
      );

      expect(actualCost.toString()).to.equal(expectedCost.toFixed(0));
    });

    it('should use by-default gas correction value when not sent as parameters', function () {
      const relayCallGasLimit = 40000;
      const tokenPaymentGas = 5000;
      const estimatedGasCorrectionFactor = ESTIMATED_GAS_CORRECTION_FACTOR;
      const A0 = BigNumberJs('72530.9611');
      const A1 = BigNumberJs('1.1114');
      let expectedCost = A1.multipliedBy(
        BigNumberJs(relayCallGasLimit).plus(tokenPaymentGas)
      ).plus(A0);
      expectedCost = expectedCost.multipliedBy(estimatedGasCorrectionFactor);

      const actualCost = estimateMaxPossibleWithLinearFit(
        relayCallGasLimit,
        tokenPaymentGas
      );

      expect(actualCost.toString()).to.equal(expectedCost.toFixed(0));
    });
  });
});
