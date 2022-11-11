import type { EnvelopingTypes } from '@rsksmart/rif-relay-contracts/dist/typechain-types/contracts/RelayHub';

export type RelayOrDeployRequest =
  | EnvelopingTypes.RelayRequestStruct
  | EnvelopingTypes.DeployRequestStruct;

export type RelayEstimation = {
  gasPrice: string;
  estimation: string;
  requiredTokenAmount: string;
  requiredNativeAmount: string;
  exchangeRate: string;
};

export type HubInfo = {
  relayWorkerAddress: string;
  relayManagerAddress: string;
  relayHubAddress: string;
  feesReceiver: string;
  minGasPrice: string;
  networkId?: string;
  chainId?: string;
  ready: boolean;
  version: string;
};
