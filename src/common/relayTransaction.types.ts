import type { EnvelopingMetadata } from './relayHub.types';
import type {
  DeployRequest,
  EnvelopingRequest,
  RelayRequest,
} from './relayRequest.types';

type RelayTransactionRequest = {
  relayRequest: RelayRequest;
  metadata: EnvelopingMetadata;
};

type DeployTransactionRequest = {
  relayRequest: DeployRequest; // FIXME: rename to deployRequest OR both to envelopingRequest
  metadata: EnvelopingMetadata;
};

type EnvelopingTxRequest = {
  relayRequest: EnvelopingRequest;
  metadata: EnvelopingMetadata;
};

export {
  RelayTransactionRequest,
  DeployTransactionRequest,
  EnvelopingTxRequest,
};
