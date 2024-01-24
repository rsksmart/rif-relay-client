import type { BigNumberish, Wallet } from 'ethers';
import type { RelayInfo } from './relayHub.types';
import type {
  RelayRequestBody,
  EnvelopingRequestData,
} from './relayRequest.types';
import type { EnvelopingTxRequest } from './relayTransaction.types';

type RequestConfig = {
  isSmartWalletDeploy?: boolean; // its no longer necessary
  preDeploySWAddress?: string; // its not necessary to be here, we calculate it whenever is needed
  clientId?: string;
  useEnveloping?: boolean;
  forceGasPrice?: string;
  forceGasLimit?: string;
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

type HubEnvelopingTx = {
  envelopingTx: EnvelopingTxRequest;
  activeRelay: RelayInfo;
};

type IgnoreVerifications = 'relayHub' | 'workerBalance' | 'verifiers';

type RelayTxOptions = {
  signerWallet?: Wallet;
  ignoreVerifications?: Array<IgnoreVerifications>;
  isCustom?: boolean;
};

type SmartWalletAddressTxOptions = {
  owner: string;
  smartWalletIndex: number | string;
  recoverer?: string;
  to?: string;
  data?: string;
  factoryAddress?: string;
  isCustom?: boolean;
};

export type {
  RequestConfig,
  TokenGasEstimationParams,
  EstimateInternalGasParams,
  HubEnvelopingTx,
  RelayTxOptions,
  IgnoreVerifications,
  SmartWalletAddressTxOptions,
};
