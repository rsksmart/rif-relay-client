import type { IRelayHub } from '@rsksmart/rif-relay-contracts';
import type { RelayRequestBody } from './relayRequest.types';

type RelayManagerData = {
  manager: string;
  url: string;
  currentlyStaked: boolean;
  registered: boolean;
};

type HubInfo = {
  // TODO: separate to transport (this) and internal representation (this name) types
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
  managerData: IRelayHub.RelayManagerDataStruct;
};

type EnvelopingMetadata = {
  relayHubAddress: RelayRequestBody['relayHub'];
  relayMaxNonce: RelayRequestBody['nonce'];
  signature: string;
};

export type { HubInfo, EnvelopingMetadata, RelayInfo, RelayManagerData };
