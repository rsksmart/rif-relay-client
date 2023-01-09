import { BigNumber, utils } from 'ethers';
import { isDeployRequest } from '../common/relayRequest.utils';
import type { EnvelopingTxRequest } from '../common/relayTransaction.types';
import RelayClient from '../RelayClient';
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

  const relayClient = new RelayClient();

  const isSmartWalletDeploy = isDeployRequest(relayRequest);

  const { from, index, recoverer } = relayRequest.request as {
    from: string;
    index: number;
    recoverer: string;
    to: string;
    data: string;
  };

  const preDeploySWAddress = isSmartWalletDeploy
    ? await relayClient.getSmartWalletAddress(from, index, recoverer)
    : undefined;

  const tokenEstimation = await relayClient.estimateTokenTransferGas({
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
    return await standardMaxPossibleGasEstimation(
      envelopingRequest,
      relayWorkerAddress,
      tokenEstimation
    );
  }

  return await linearFitMaxPossibleGasEstimation(relayRequest, tokenEstimation);
};

export { estimateRelayMaxPossibleGas };
