import { BigNumber, constants, utils, Wallet } from 'ethers';
import { estimatePaymentGas, estimateInternalCallGas } from '../utils';
import { isDeployRequest } from '../common/relayRequest.utils';
import type { EnvelopingTxRequest } from '../common/relayTransaction.types';
import {
  POST_RELAY_DEPLOY_GAS_COST,
  PRE_RELAY_GAS_COST,
  resolveSmartWalletAddress,
  standardMaxPossibleGasEstimation,
  STORAGE_REFUND,
  POST_DEPLOY_EXECUTION,
  POST_DEPLOY_NO_EXECUTION,
} from './utils';
import {
  getProvider,
  type EnvelopingRequest,
  type RelayTxOptions,
} from '../common';
import {
  BaseSmartWalletFactory__factory,
  RelayHub__factory,
} from '@rsksmart/rif-relay-contracts';
import { signEnvelopingRequest } from '../signer';

const estimateRelayMaxPossibleGas = async (
  envelopingRequest: EnvelopingTxRequest,
  relayWorkerAddress: string,
  options?: RelayTxOptions
): Promise<BigNumber> => {
  const { relayRequest } = envelopingRequest;

  const tokenAmount = await relayRequest.request.tokenAmount;

  if (!BigNumber.from(tokenAmount).isZero()) {
    throw Error('Token amount needs to be 0');
  }

  const smartWalletAddress = await resolveSmartWalletAddress(
    relayRequest,
    options
  );

  const tokenEstimation = await estimatePaymentGas({
    relayRequest: {
      ...relayRequest,
      request: {
        ...relayRequest.request,
        tokenAmount: utils.formatUnits(1, 'wei'),
      },
    },
    preDeploySWAddress: smartWalletAddress,
  });

  const maxPossibleGas = await standardMaxPossibleGasEstimation(
    envelopingRequest,
    relayWorkerAddress
  );

  return maxPossibleGas.add(tokenEstimation);
};

/**
 * We try to estimate the maximum possible gas that the transaction will consume
 * without requiring the signature of the user. The idea is to apply 2 different strategies
 * according to the type of request:
 * - deploy: the server signs the request and estimates the gas of the deployment with a static call
 * - relay: we split the requests into different stages
 *    - preEnvelopedTxEstimation: the gas required without the payment and the internal call
 *    - paymentEstimation: the gas required for the payment
 *    - internalEstimation: the gas required for the internal call
 *    - POST_DEPLOY_NO_EXECUTION: when there is no execution in deployment, an additional 4_000 are needed
 *    - POST_DEPLOY_EXECUTION: when there is execution in deployment, an additional 1_500 are needed
 *    - STORAGE_REFUND: After the nonces were already touched by a smart wallet deployment or smart wallet execution, we need to subtract 15_000
 * - Manually subtract:
 *    - Without signature, we cannot analyze if there some of the gas costs should be included or not, to avoid underestimating the relay transaction
 *      the costs are included in all of them. These costs can be subtract by using the following constants:
 *      - POST_RELAY_DEPLOY_GAS_COST: transfer back cost is always included since we cannot know if the smart wallet is going
 *        to have some balance after the execution
 *      - OWNER_ALREADY_TOUCHED: Owner already touched, the owner of the smart wallet was previously touched
 * @param relayRequest
 * @param signer
 * @param options
 * @returns
 */
const estimateRelayMaxPossibleGasNoSignature = async (
  relayRequest: EnvelopingRequest,
  signer: Wallet,
  options?: RelayTxOptions
) => {
  const tokenAmount = await relayRequest.request.tokenAmount;

  if (!BigNumber.from(tokenAmount).isZero()) {
    throw Error('Token amount needs to be 0');
  }

  if (options?.isCustom) {
    throw Error('CustomSmartWallet is not supported');
  }

  const {
    request,
    relayData: { gasPrice },
  } = relayRequest;

  let preEnvelopedTxEstimation = BigNumber.from(PRE_RELAY_GAS_COST);
  const isDeploy = isDeployRequest(relayRequest);
  if (isDeploy) {
    const from = signer.address;
    const provider = getProvider();
    const factory = BaseSmartWalletFactory__factory.connect(
      await relayRequest.relayData.callForwarder,
      provider
    );
    const nonce = await factory.nonce(from);
    const updatedRelayRequest = {
      request: {
        ...relayRequest.request,
        from,
        to: constants.AddressZero,
        nonce,
      },
      relayData: {
        ...relayRequest.relayData,
      },
    };
    const signature = signEnvelopingRequest(updatedRelayRequest, from, signer);
    const relayHub = RelayHub__factory.connect(
      await request.relayHub,
      provider
    );

    preEnvelopedTxEstimation = await relayHub.estimateGas.deployCall(
      updatedRelayRequest,
      signature,
      { gasPrice, from }
    );
  }

  const smartWalletAddress = await resolveSmartWalletAddress(
    relayRequest,
    options
  );

  const paymentEstimation = await estimatePaymentGas({
    relayRequest: {
      ...relayRequest,
      request: {
        ...relayRequest.request,
        tokenAmount: utils.formatUnits(1, 'wei'),
      },
    },
    preDeploySWAddress: smartWalletAddress,
  });

  let internalEstimation = BigNumber.from(0);
  const to = await relayRequest.request.to;
  if (to != constants.AddressZero) {
    internalEstimation = await estimateInternalCallGas({
      data: relayRequest.request.data,
      from: smartWalletAddress,
      to,
      gasPrice,
    });
  }

  let missingGas = 0;
  if (isDeploy) {
    if (to == constants.AddressZero) {
      missingGas = POST_DEPLOY_NO_EXECUTION;
    } else {
      missingGas = POST_DEPLOY_EXECUTION;
    }
  }

  const nonce = BigNumber.from(await request.nonce);
  if (!nonce.isZero()) {
    missingGas -= STORAGE_REFUND;
  }

  return preEnvelopedTxEstimation
    .add(paymentEstimation)
    .add(internalEstimation)
    .add(POST_RELAY_DEPLOY_GAS_COST) // Since we don't have a way to know if the smart wallet is going to have some balance after the execution, we always include this value.
    .add(missingGas); // In the deploy tx, there is some missing gas that needs to be included if there is no execution or it is paid with native token
};

export { estimateRelayMaxPossibleGas, estimateRelayMaxPossibleGasNoSignature };
