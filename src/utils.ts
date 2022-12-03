import type {
  DeployTransactionRequest,
  RelayTransactionRequest,
  EnvelopingTransactionDetails
} from '@rsksmart/rif-relay-common';

export const isDeployTransaction = (
  req: RelayTransactionRequest | DeployTransactionRequest
) => {
  const {
    relayRequest: { request },
  } = req;

  const { recoverer } = request as { recoverer: string };

  if (recoverer) {
    return true;
  }

  return false;
};

export interface PingResponse {
  relayWorkerAddress: string;
  relayManagerAddress: string;
  relayHubAddress: string;
  feesReceiver: string;
  minGasPrice: string;
  networkId?: string;
  chainId?: string;
  ready: boolean;
  version: string;
}

/**
 * For legacy reasons, to filter out the relay this filter has to throw.
 * TODO: make ping filtering sane!
 */
 export type PingFilter = (
  pingResponse: PingResponse,
  transactionDetails: EnvelopingTransactionDetails
) => void;

export interface RelayManagerData {
  manager: string;
  url: string;
  currentlyStaked: boolean;
  registered: boolean;
}

// Well, I still don't like it
// Some info is known from the event, some from ping
export interface PartialRelayInfo {
  relayInfo: RelayManagerData;
  pingResponse: PingResponse;
}

export interface RelayInfo {
  pingResponse: PingResponse;
  relayInfo: RelayManagerData;
}
