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

const PRE_RELAY_GAS_COST = 74_000;
const POST_RELAY_DEPLOY_GAS_COST = 33_500;
const POST_DEPLOY_EXECUTION = 1_500;
const POST_DEPLOY_NO_EXECUTION = 4_000;
const STORAGE_REFUND = 15_000;
const ACCOUNT_ALREADY_CREATED = 25_000;

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

const isAccountCreated = async (address: string) => {
  const provider = getProvider();
  const ownerBalance = await provider.getBalance(address);
  const ownerTx = await provider.getTransactionCount(address);

  return !ownerBalance.isZero() || ownerTx > 0;
};

export {
  standardMaxPossibleGasEstimation,
  resolveSmartWalletAddress,
  isAccountCreated,
  PRE_RELAY_GAS_COST,
  POST_RELAY_DEPLOY_GAS_COST,
  POST_DEPLOY_EXECUTION,
  POST_DEPLOY_NO_EXECUTION,
  STORAGE_REFUND,
  ACCOUNT_ALREADY_CREATED,
};
