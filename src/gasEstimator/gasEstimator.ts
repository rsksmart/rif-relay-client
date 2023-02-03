import { BigNumber, utils } from 'ethers';
import { getSmartWalletAddress, estimateTokenTransferGas } from '../utils';
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

  const { from, index, recoverer, to, data } = relayRequest.request as {
    from: string;
    index: number;
    recoverer: string;
    to: string;
    data: string;
  };

  const callForwarder = relayRequest.relayData.callForwarder.toString();

  const preDeploySWAddress = isSmartWalletDeploy
    ? await getSmartWalletAddress(
        from,
        index,
        recoverer,
        to,
        data,
        callForwarder
      )
    : undefined;

  const tokenEstimation = await estimateTokenTransferGas({
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
