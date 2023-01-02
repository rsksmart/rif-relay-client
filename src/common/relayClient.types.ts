import type { BigNumberish } from 'ethers';
import type {
  RelayRequestBody,
  EnvelopingRequestData,
} from './relayRequest.types';
import type { EnvelopingTxRequest } from './relayTransaction.types';

type RequestConfig = {
  isSmartWalletDeploy?: boolean;
  preDeploySWAddress?: string;
  clientId?: string;
  useEnveloping?: boolean;
  forceGasPrice?: string;
  forceGasLimit?: string;
  forceTokenGasLimit?: string;
  onlyPreferredRelays?: boolean;
  ignoreTransactionReceipt?: boolean;
  retries?: number;
  initialBackoff?: number;
  internalEstimationCorrection?: BigNumberish;
  estimatedGasCorrectionFactor?: BigNumberish;
};

//FIXME name standardization
type TokenGasEstimationParams = Pick<EnvelopingTxRequest, 'relayRequest'> &
  Pick<
    RequestConfig,
    | 'isSmartWalletDeploy'
    | 'preDeploySWAddress'
    | 'internalEstimationCorrection'
    | 'estimatedGasCorrectionFactor'
  >;

//FIXME name standardization
type EstimateInternalGasParams = Pick<
  RelayRequestBody,
  'data' | 'to' | 'from'
> &
  Pick<EnvelopingRequestData, 'gasPrice'> &
  Pick<
    RequestConfig,
    'internalEstimationCorrection' | 'estimatedGasCorrectionFactor'
  >;

export type {
  RequestConfig,
  TokenGasEstimationParams,
  EstimateInternalGasParams,
};
