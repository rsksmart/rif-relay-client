import type { RelayManagerData } from './config.types';

type HubInfo = {
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

type RelayInfo = {
  hubInfo: HubInfo;
  relayInfo: RelayManagerData;
};

type RelayMetadata = {
  relayHubAddress: string;
  relayMaxNonce: number;
  signature: string;
};

export type { HubInfo, RelayMetadata, RelayInfo };
