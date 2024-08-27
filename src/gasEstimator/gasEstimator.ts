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
  let relayEstimation = BigNumber.from(PRE_RELAY_GAS_COST);
  let reduction = POST_DEPLOY_GAS_COST;
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

    relayEstimation = await relayHub.estimateGas.deployCall(
      updatedRelayRequest,
      signature,
      { gasPrice, from }
    );

    reduction = POST_RELAY_GAS_COST;
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

  return relayEstimation
    .add(tokenEstimation)
    .add(internalEstimation)
    .add(POST_DEPLOY_GAS_COST)
    .add(POST_RELAY_GAS_COST)
    .sub(reduction);
};

export { estimateRelayMaxPossibleGas, estimateRelayMaxPossibleGasNoSignature };
