import type {
  DeployOnlyRequestKey,
  DeployRequest,
  EnvelopingRequest,
  RelayRequest,
} from './relayRequest.types';
import type {
  DeployTransactionRequest,
  EnvelopingTxRequest,
} from './relayTransaction.types';

const deployOnlyRequestKeys: DeployOnlyRequestKey[] = ['index'];

const isRelayRequest = (
  request: EnvelopingRequest
): request is RelayRequest => {
  return !isDeployRequest(request);
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
