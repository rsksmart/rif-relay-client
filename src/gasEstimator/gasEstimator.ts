import { BigNumber, constants, utils, Wallet } from 'ethers';
import { estimatePaymentGas, estimateInternalCallGas } from '../utils';
import { isDeployRequest } from '../common/relayRequest.utils';
import type { EnvelopingTxRequest } from '../common/relayTransaction.types';
import {
  POST_RELAY_GAS_COST,
  POST_DEPLOY_GAS_COST,
  PRE_RELAY_GAS_COST,
  POST_DEPLOY_GAS_COST_NO_EXECUTION,
  resolveSmartWalletAddress,
  standardMaxPossibleGasEstimation,
} from './utils';
import {
  getProvider,
  type EnvelopingRequest,
  type RelayTxOptions,
} from '../common';
import { RelayHub__factory } from '@rsksmart/rif-relay-contracts';
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
 * We try to estimation the maximum possible gas that the transaction will consume
 * without requiring the signature of the user. The idea is to apply 2 different strategies
 * according to the type of request:
 * - deploy: the server signs the request and estimates the gas of the deployment with a static call
 * - relay: we split the requests into different stages
 *    - preEnvelopedTxEstimation: the gas required without the payment and the internal call
 *    - paymentEstimation: the gas required for the payment
 *    - internalEstimation: the gas required for the internal call
 *    - postEnvelopedTxEstimation: the gas required after the internal call.
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

  const {
    request,
    relayData: { gasPrice },
  } = relayRequest;

  const isDeploy = isDeployRequest(relayRequest);
  let preEnvelopedTxEstimation = BigNumber.from(PRE_RELAY_GAS_COST);
  let postEnvelopedTxEstimation = POST_RELAY_GAS_COST;
  if (isDeploy) {
    const from = signer.address;
    const updatedRelayRequest = {
      request: {
        ...relayRequest.request,
        from,
        to: constants.AddressZero,
      },
      relayData: {
        ...relayRequest.relayData,
      },
    };
    const signature = signEnvelopingRequest(updatedRelayRequest, from, signer);
    const provider = getProvider();
    const relayHub = RelayHub__factory.connect(
      await request.relayHub,
      provider
    );

    preEnvelopedTxEstimation = await relayHub.estimateGas.deployCall(
      updatedRelayRequest,
      signature,
      { gasPrice, from }
    );

    // TODO: Are we sure we need this?
    postEnvelopedTxEstimation = POST_DEPLOY_GAS_COST;
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

  const { to, data } = relayRequest.request;
  let internalEstimation = BigNumber.from(0);
  if (to != constants.AddressZero) {
    internalEstimation = await estimateInternalCallGas({
      data,
      from: smartWalletAddress,
      to,
      gasPrice,
    });
  } else if (isDeploy) {
    internalEstimation = BigNumber.from(POST_DEPLOY_GAS_COST_NO_EXECUTION);
  }

  return preEnvelopedTxEstimation
    .add(paymentEstimation)
    .add(internalEstimation)
    .add(postEnvelopedTxEstimation);
};

export { estimateRelayMaxPossibleGas, estimateRelayMaxPossibleGasNoSignature };
