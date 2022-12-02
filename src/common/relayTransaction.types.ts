import type { RelayMetadata } from './relayHub.types';
import type { DeployRequest, RelayRequest } from './relayRequest.types';

type RelayTransactionRequest = {
  relayRequest: RelayRequest;
  metadata: RelayMetadata;
};

type DeployTransactionRequest = {
  relayRequest: DeployRequest;
  metadata: RelayMetadata;
};

type EnvelopingTxRequest = RelayTransactionRequest | DeployTransactionRequest;

export {
  RelayTransactionRequest,
  DeployTransactionRequest,
  EnvelopingTxRequest,
};
