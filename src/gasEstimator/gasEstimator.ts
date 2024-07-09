import { BigNumber, utils } from 'ethers';
import {
  getSmartWalletAddress,
  estimatePaymentGas,
  isCustomSmartWalletDeployment,
} from '../utils';
import { isDeployRequest } from '../common/relayRequest.utils';
import type { EnvelopingTxRequest } from '../common/relayTransaction.types';
import {
  standardMaxPossibleGasEstimation,
  linearFitMaxPossibleGasEstimation,
} from './utils';

const estimateRelayMaxPossibleGas = async (
  envelopingRequest: EnvelopingTxRequest,
  relayWorkerAddress: string
): Promise<BigNumber> => {
  const {
    relayRequest,
    metadata: { signature },
  } = envelopingRequest;

  const isSmartWalletDeploy = isDeployRequest(relayRequest);

  const { from, index, recoverer, to, data } = relayRequest.request;

  const smartWalletIndex = await index;

  const callForwarder = await relayRequest.relayData.callForwarder;

  const isCustom = await isCustomSmartWalletDeployment(relayRequest);

  const preDeploySWAddress = isSmartWalletDeploy
    ? await getSmartWalletAddress({
        owner: await from,
        smartWalletIndex: smartWalletIndex!,
        recoverer: await recoverer,
        to: await to,
        data: await data,
        factoryAddress: callForwarder,
        isCustom,
      })
    : undefined;

  const tokenEstimation = await estimatePaymentGas({
    relayRequest: {
      ...relayRequest,
      request: {
        ...relayRequest.request,
        tokenAmount: utils.formatUnits(1, 'wei'),
      },
    },
    preDeploySWAddress,
  });

  if (signature > '0x0') {
    const maxPossibleGas = await standardMaxPossibleGasEstimation(
      envelopingRequest,
      relayWorkerAddress
    );

    return maxPossibleGas.add(tokenEstimation);
  }

  return await linearFitMaxPossibleGasEstimation(relayRequest, tokenEstimation);
};

export { estimateRelayMaxPossibleGas };
