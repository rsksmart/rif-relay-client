import type { BigNumberish, BigNumber } from 'ethers';
import { RelayHub__factory } from '@rsksmart/rif-relay-contracts';
import type {
  EnvelopingRequest,
  RelayRequest,
} from '../common/relayRequest.types';
import { isDeployRequest } from '../common/relayRequest.utils';
import type { EnvelopingTxRequest } from '../common/relayTransaction.types';
import { applyGasCorrectionFactor, getSmartWalletAddress } from '../utils';
import { getProvider } from '../common/clientConfigurator';
import type { RelayTxOptions } from '../common';

const PRE_RELAY_GAS_COST = 70_500;
const POST_RELAY_GAS_COST = 36_800;
const POST_DEPLOY_GAS_COST = 33_300;
const POST_DEPLOY_GAS_COST_NO_EXECUTION = 4_000;

const standardMaxPossibleGasEstimation = async (
  { relayRequest, metadata: { signature } }: EnvelopingTxRequest,
  relayWorkerAddress: string,
  estimatedGasCorrectionFactor?: BigNumberish
): Promise<BigNumber> => {
  const {
    request,
    relayData: { gasPrice },
  } = relayRequest;

  const provider = getProvider();

  const relayHub = RelayHub__factory.connect(
    request.relayHub.toString(),
    provider
  );

  const methodToEstimate = isDeployRequest(relayRequest)
    ? await relayHub.populateTransaction.deployCall(relayRequest, signature)
    : await relayHub.populateTransaction.relayCall(
        relayRequest as RelayRequest,
        signature
      );

  const relayEstimation = await provider.estimateGas({
    ...methodToEstimate,
    gasPrice,
    from: relayWorkerAddress,
  });

  const correctedEstimation = applyGasCorrectionFactor(
    relayEstimation,
    estimatedGasCorrectionFactor
  );

  return correctedEstimation;
};

const resolveSmartWalletAddress = async (
  relayRequest: EnvelopingRequest,
  options?: RelayTxOptions
) => {
  const { from, index, recoverer, to, data } = relayRequest.request;
  const smartWalletIndex = await index;
  const callForwarder = await relayRequest.relayData.callForwarder;

  const isSmartWalletDeploy = isDeployRequest(relayRequest);
  const isCustom = options?.isCustom;

  return isSmartWalletDeploy
    ? await getSmartWalletAddress({
        owner: await from,
        smartWalletIndex: smartWalletIndex!,
        recoverer: await recoverer,
        to: await to,
        data: await data,
        factoryAddress: callForwarder,
        isCustom,
      })
    : callForwarder;
};

export {
  standardMaxPossibleGasEstimation,
  resolveSmartWalletAddress,
  PRE_RELAY_GAS_COST,
  POST_RELAY_GAS_COST,
  POST_DEPLOY_GAS_COST,
  POST_DEPLOY_GAS_COST_NO_EXECUTION,
};
