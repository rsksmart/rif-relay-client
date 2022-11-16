import type {
  DeployTransactionRequest,
  RelayTransactionRequest,
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
