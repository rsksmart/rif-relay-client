import type { EnvelopingMetadata } from './relayHub.types';
import type { DeployRequest, RelayRequest } from './relayRequest.types';

type RelayTransactionRequest = {
  relayRequest: RelayRequest;
  metadata: EnvelopingMetadata;
};

type DeployTransactionRequest = {
  relayRequest: DeployRequest; // FIXME: rename to deployRequest OR both to envelopingRequest
  metadata: EnvelopingMetadata;
};

type EnvelopingTxRequest = RelayTransactionRequest | DeployTransactionRequest;

export {
  RelayTransactionRequest,
  DeployTransactionRequest,
  EnvelopingTxRequest,
};
