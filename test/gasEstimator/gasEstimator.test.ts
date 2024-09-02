import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { createSandbox, SinonStubbedInstance } from 'sinon';
import { BigNumber, constants, providers, Wallet } from 'ethers';
import { RelayHub, RelayHub__factory } from '@rsksmart/rif-relay-contracts';

import {
  FAKE_DEPLOY_REQUEST,
  FAKE_DEPLOY_TRANSACTION_REQUEST,
  FAKE_RELAY_REQUEST,
  FAKE_RELAY_TRANSACTION_REQUEST,
} from '../request.fakes';
import {
  estimateRelayMaxPossibleGas,
  estimateRelayMaxPossibleGasNoSignature,
} from '../../src/gasEstimator/gasEstimator';
import {
  PRE_RELAY_GAS_COST,
  resolveSmartWalletAddress,
  standardMaxPossibleGasEstimation,
} from '../../src/gasEstimator/utils';
import { createRandomAddress } from '../utils';
import type { EnvelopingTxRequest } from '../../src';
import * as gasEstimatorUtils from '../../src/gasEstimator/utils';
import * as clientConfiguration from '../../src/common/clientConfigurator';
import * as relayUtils from '../../src/utils';
import * as signerUtils from '../../src/signer';

use(sinonChai);
use(chaiAsPromised);

const sandbox = createSandbox();

const randomBigNumber = (max: number) =>
  BigNumber.from((Math.random() * max).toFixed(0));

describe('GasEstimator', function () {
  let relayTransactionRequest: EnvelopingTxRequest;
  let deployTransactionRequest: EnvelopingTxRequest;

  before(function () {
    relayTransactionRequest = {
      ...FAKE_RELAY_TRANSACTION_REQUEST,
      relayRequest: {
        ...FAKE_RELAY_TRANSACTION_REQUEST.relayRequest,
        request: {
          ...FAKE_RELAY_TRANSACTION_REQUEST.relayRequest.request,
          tokenAmount: 0,
        },
      },
    };
    deployTransactionRequest = {
      ...FAKE_DEPLOY_TRANSACTION_REQUEST,
      relayRequest: {
        ...FAKE_DEPLOY_TRANSACTION_REQUEST.relayRequest,
        request: {
          ...FAKE_DEPLOY_TRANSACTION_REQUEST.relayRequest.request,
          tokenAmount: 0,
        },
      },
    };
  });

  describe('estimateRelayMaxPossibleGas', function () {
    let fakeTokenGas: BigNumber;
    let fakeDeployEstimation: BigNumber;
    let fakeRelayEstimation: BigNumber;
    let relayWorker: string;

    beforeEach(function () {
      fakeTokenGas = randomBigNumber(10000);
      fakeDeployEstimation = randomBigNumber(10000);
      fakeRelayEstimation = randomBigNumber(10000);
      relayWorker = Wallet.createRandom().address;
      sandbox.stub(relayUtils, 'estimatePaymentGas').resolves(fakeTokenGas);
      sandbox
        .stub(relayUtils, 'getSmartWalletAddress')
        .resolves(createRandomAddress());
    });

    afterEach(function () {
      sandbox.restore();
    });

    it('should estimate the relay transaction', async function () {
      sandbox
        .stub(gasEstimatorUtils, 'standardMaxPossibleGasEstimation')
        .resolves(fakeRelayEstimation);

      const estimation = await estimateRelayMaxPossibleGas(
        relayTransactionRequest,
        relayWorker
      );

      const expectedEstimation = fakeRelayEstimation.add(fakeTokenGas);

      expect(
        estimation.eq(expectedEstimation),
        `${estimation.toString()} should equal ${expectedEstimation.toString()}`
      ).to.be.true;
    });

    it('should estimate the deploy transaction', async function () {
      sandbox
        .stub(gasEstimatorUtils, 'standardMaxPossibleGasEstimation')
        .resolves(fakeDeployEstimation);

      const estimation = await estimateRelayMaxPossibleGas(
        deployTransactionRequest,
        relayWorker
      );

      const expectedEstimation = fakeDeployEstimation.add(fakeTokenGas);

      expect(
        estimation.eq(expectedEstimation),
        `${estimation.toString()} should equal ${expectedEstimation.toString()}`
      ).to.be.true;
    });

    it('should fail if `tokenAmount` is not 0', async function () {
      await expect(
        estimateRelayMaxPossibleGas(FAKE_RELAY_TRANSACTION_REQUEST, relayWorker)
      ).to.be.rejectedWith('Token amount needs to be 0');
    });
  });

  describe('standardMaxPossibleGasEstimation', function () {
    let fakeDeployGas: BigNumber;
    let fakeRelayGas: BigNumber;
    let relayWorker: string;
    let providerStub: SinonStubbedInstance<providers.BaseProvider>;
    let relayHubStub: SinonStubbedInstance<RelayHub>;

    beforeEach(function () {
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
      providerStub.estimateGas.resolves(fakeRelayGas);

      const estimation = await standardMaxPossibleGasEstimation(
        FAKE_RELAY_TRANSACTION_REQUEST,
        relayWorker
      );

      expect(
        estimation.eq(fakeRelayGas),
        `${estimation.toString()} should equal ${fakeRelayGas.toString()}`
      ).to.be.true;
    });

    it('should estimate the deploy transaction', async function () {
      providerStub.estimateGas.resolves(fakeDeployGas);

      const estimation = await standardMaxPossibleGasEstimation(
        FAKE_DEPLOY_TRANSACTION_REQUEST,
        relayWorker
      );

      expect(
        estimation.eq(fakeDeployGas),
        `${estimation.toString()} should equal ${fakeDeployGas.toString()}`
      ).to.be.true;
    });
  });

  describe('estimateRelayMaxPossibleGasNoSignature', function () {
    let fakeTokenGas: BigNumber;
    let fakeInternalGas: BigNumber;
    let relayWorker: Wallet;

    beforeEach(function () {
      fakeTokenGas = randomBigNumber(10000);
      fakeInternalGas = randomBigNumber(10000);

      relayWorker = Wallet.createRandom();
      sandbox.stub(relayUtils, 'estimatePaymentGas').resolves(fakeTokenGas);
      sandbox
        .stub(relayUtils, 'estimateInternalCallGas')
        .resolves(fakeInternalGas);
    });

    afterEach(function () {
      sandbox.restore();
    });

    it('should fail if `tokenAmount` is not 0', async function () {
      await expect(
        estimateRelayMaxPossibleGasNoSignature(
          {
            ...relayTransactionRequest.relayRequest,
            request: {
              ...relayTransactionRequest.relayRequest.request,
              tokenAmount: constants.One,
            },
          },
          relayWorker
        )
      ).to.be.rejectedWith('Token amount needs to be 0');
    });

    it('should fail if CustomSmartWallet ', async function () {
      await expect(
        estimateRelayMaxPossibleGasNoSignature(
          relayTransactionRequest.relayRequest,
          relayWorker,
          {
            isCustom: true,
          }
        )
      ).to.be.rejectedWith('CustomSmartWallet is not supported');
    });

    describe('should estimate the relay request', function () {
      before(async function () {
        sandbox
          .stub(gasEstimatorUtils, 'resolveSmartWalletAddress')
          .resolves(
            await relayTransactionRequest.relayRequest.relayData.callForwarder
          );
      });

      it('with token', async function () {
        const estimation = await estimateRelayMaxPossibleGasNoSignature(
          relayTransactionRequest.relayRequest,
          relayWorker
        );

        const expectedEstimation = BigNumber.from(PRE_RELAY_GAS_COST)
          .add(fakeTokenGas)
          .add(fakeInternalGas)
          .add(gasEstimatorUtils.POST_RELAY_DEPLOY_GAS_COST);

        expect(estimation).eqls(
          expectedEstimation,
          `${estimation.toString()} should equal ${expectedEstimation.toString()}`
        );
      });

      it('with native token', async function () {
        const estimation = await estimateRelayMaxPossibleGasNoSignature(
          {
            ...relayTransactionRequest.relayRequest,
            request: {
              ...relayTransactionRequest.relayRequest.request,
              tokenContract: constants.AddressZero,
            },
          },
          relayWorker
        );

        const expectedEstimation = BigNumber.from(PRE_RELAY_GAS_COST)
          .add(fakeTokenGas)
          .add(fakeInternalGas)
          .add(gasEstimatorUtils.POST_RELAY_DEPLOY_GAS_COST);

        expect(estimation).eqls(
          expectedEstimation,
          `${estimation.toString()} should equal ${expectedEstimation.toString()}`
        );
      });
    });

    describe('should estimate the deploy request', function () {
      let deployEstimation: BigNumber;

      beforeEach(function () {
        deployEstimation = randomBigNumber(10000);
        sandbox
          .stub(gasEstimatorUtils, 'resolveSmartWalletAddress')
          .resolves(createRandomAddress());
        sandbox
          .stub(signerUtils, 'signEnvelopingRequest')
          .resolves('signature');
        const providerStub = sandbox.createStubInstance(providers.BaseProvider);
        sandbox.stub(clientConfiguration, 'getProvider').returns(providerStub);

        const relayHubStub = {
          estimateGas: {
            deployCall: () => Promise.resolve(deployEstimation),
          },
        } as unknown as RelayHub;

        sandbox.stub(RelayHub__factory, 'connect').returns(relayHubStub);
      });

      describe('with contract execution', function () {
        it('with token', async function () {
          const estimation = await estimateRelayMaxPossibleGasNoSignature(
            deployTransactionRequest.relayRequest,
            relayWorker
          );

          const expectedEstimation = deployEstimation
            .add(fakeTokenGas)
            .add(fakeInternalGas)
            .add(gasEstimatorUtils.POST_RELAY_DEPLOY_GAS_COST)
            .add(gasEstimatorUtils.POST_DEPLOY_EXECUTION_FACTOR * 3);

          expect(estimation).eqls(
            expectedEstimation,
            `${estimation.toString()} should equal ${expectedEstimation.toString()}`
          );
        });

        it('with native token', async function () {
          const estimation = await estimateRelayMaxPossibleGasNoSignature(
            {
              ...deployTransactionRequest.relayRequest,
              request: {
                ...deployTransactionRequest.relayRequest.request,
                tokenContract: constants.AddressZero,
              },
            },
            relayWorker
          );

          const expectedEstimation = deployEstimation
            .add(fakeTokenGas)
            .add(fakeInternalGas)
            .add(gasEstimatorUtils.POST_RELAY_DEPLOY_GAS_COST)
            .add(gasEstimatorUtils.POST_DEPLOY_EXECUTION_FACTOR * 3);

          expect(estimation).eqls(
            expectedEstimation,
            `${estimation.toString()} should equal ${expectedEstimation.toString()}`
          );
        });
      });

      describe('without contract execution', function () {
        before(function () {
          deployTransactionRequest = {
            ...deployTransactionRequest,
            relayRequest: {
              ...deployTransactionRequest.relayRequest,
              request: {
                ...deployTransactionRequest.relayRequest.request,
                to: constants.AddressZero,
              },
            },
          };
        });

        it('with token', async function () {
          const estimation = await estimateRelayMaxPossibleGasNoSignature(
            deployTransactionRequest.relayRequest,
            relayWorker
          );

          const expectedEstimation = deployEstimation
            .add(fakeTokenGas)
            .add(gasEstimatorUtils.POST_RELAY_DEPLOY_GAS_COST)
            .add(gasEstimatorUtils.POST_DEPLOY_EXECUTION_FACTOR * 8);

          expect(estimation).eqls(
            expectedEstimation,
            `${estimation.toString()} should equal ${expectedEstimation.toString()}`
          );
        });

        it('with native token', async function () {
          const estimation = await estimateRelayMaxPossibleGasNoSignature(
            {
              ...deployTransactionRequest.relayRequest,
              request: {
                ...deployTransactionRequest.relayRequest.request,
                tokenContract: constants.AddressZero,
              },
            },
            relayWorker
          );

          const expectedEstimation = deployEstimation
            .add(fakeTokenGas)
            .add(gasEstimatorUtils.POST_RELAY_DEPLOY_GAS_COST)
            .add(gasEstimatorUtils.POST_DEPLOY_EXECUTION_FACTOR * 8);

          expect(estimation).eqls(
            expectedEstimation,
            `${estimation.toString()} should equal ${expectedEstimation.toString()}`
          );
        });
      });
    });
  });

  describe('resolveSmartWalletAddress', function () {
    afterEach(function () {
      sandbox.restore();
    });

    it('should return callforwarder as smart wallet address if relay request', async function () {
      const smartWalletAddress = await resolveSmartWalletAddress(
        FAKE_RELAY_REQUEST
      );

      expect(smartWalletAddress).to.be.equal(
        FAKE_RELAY_REQUEST.relayData.callForwarder
      );
    });

    it('should get smart wallet address from factory if deploy request', async function () {
      const expectedSmartWalletAddress = createRandomAddress();
      sandbox
        .stub(relayUtils, 'getSmartWalletAddress')
        .resolves(expectedSmartWalletAddress);
      const smartWalletAddress = await resolveSmartWalletAddress(
        FAKE_DEPLOY_REQUEST
      );

      expect(smartWalletAddress).to.be.equal(expectedSmartWalletAddress);
    });
  });
});
