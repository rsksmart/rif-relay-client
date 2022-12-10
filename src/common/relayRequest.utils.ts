import type {
  DeployOnlyRequestKey,
  DeployRequest,
  EnvelopingRequest,
  RelayOnlyRequestKey,
  RelayRequest,
} from './relayRequest.types';
import type {
  DeployTransactionRequest,
  EnvelopingTxRequest,
} from './relayTransaction.types';

const relayOnlyRequestKeys: RelayOnlyRequestKey[] = ['gas'];

const deployOnlyRequestKeys: DeployOnlyRequestKey[] = ['index', 'recoverer'];

const isRelayRequest = (
  request: EnvelopingRequest
): request is RelayRequest => {
  return relayOnlyRequestKeys.every((key: RelayOnlyRequestKey) => {
    return key in request.request;
  });
};

const isDeployRequest = (
  request: EnvelopingRequest
): request is DeployRequest => {
  return deployOnlyRequestKeys.every((key: DeployOnlyRequestKey) => {
    return key in request.request;
  });
};

const isDeployTransactionRequest = (
  request: EnvelopingTxRequest
): request is DeployTransactionRequest => isDeployRequest(request.relayRequest);

export {
  isRelayRequest,
  isDeployRequest,
  isDeployTransactionRequest as isDeployTransaction,
};
