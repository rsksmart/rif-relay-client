import type { BigNumberish, BytesLike, Wallet } from 'ethers';
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

type PaymentGasEstimationParams = Pick<EnvelopingTxRequest, 'relayRequest'> &
  Pick<
    RequestConfig,
    | 'isSmartWalletDeploy'
    | 'preDeploySWAddress'
    | 'internalEstimationCorrection'
    | 'estimatedGasCorrectionFactor'
  >;

//FIXME name standardization
/**
 * @deprecated The type was replaced by {@link PaymentGasEstimationParams}
 */
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
  Partial<Pick<RelayRequestBody, 'value'>> &
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
  smartWalletIndex: BigNumberish;
  recoverer?: string;
  to?: string;
  data?: string | BytesLike;
  factoryAddress?: string;
  isCustom?: boolean;
};

export type {
  RequestConfig,
  PaymentGasEstimationParams,
  TokenGasEstimationParams,
  EstimateInternalGasParams,
  HubEnvelopingTx,
  RelayTxOptions,
  IgnoreVerifications,
  SmartWalletAddressTxOptions,
};
