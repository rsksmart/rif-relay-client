/* eslint-disable */
// @ts-nocheck
import type { ContractInteractor } from '@rsksmart/rif-relay-common'; // FIXME: ContractInteractor should not be used, instead implement it's functionality directly
import type {
  DeployTransactionRequest,
  EnvelopingConfig,
  RelayTransactionRequest,
} from '@rsksmart/rif-relay-common/dist/src';
import type { Transaction } from 'ethers';
import log from 'loglevel';
import { isDeployTransaction } from './common/relayRequest.utils';
import { EnvelopingTxRequest } from './common/relayTransaction.types';

export class RelayedTransactionValidator {
  private readonly contractInteractor: ContractInteractor;

  private readonly config: EnvelopingConfig;

  constructor(
    contractInteractor: ContractInteractor,
    config: EnvelopingConfig
  ) {
    this.contractInteractor = contractInteractor;
    this.config = config;
  }

  /**
   * Decode the signed transaction returned from the Relay Server, compare it to the
   * requested transaction and validate its signature.
   */
  validateRelayResponse(
    request: EnvelopingTxRequest,
    { v, r, s, to, data, value, from, nonce }: Transaction,
    relayWorker: string
  ): void {
    log.info('validateRelayResponse - Transaction is', {
      v,
      r,
      s,
      to,
      from,
      data,
      value,
      nonce,
    });

    if (!to) {
      throw Error('Transaction has no recipient address');
    }

    if (!from) {
      throw Error('Transaction has no signer');
    }

    const isDeploy = isDeployTransaction(request);

    const relayRequestAbiEncode = isDeploy
      ? this.contractInteractor.encodeDeployCallABI(
          (request as DeployTransactionRequest).relayRequest,
          request.metadata.signature
        )
      : this.contractInteractor.encodeRelayCallABI(
          (request as RelayTransactionRequest).relayRequest,
          request.metadata.signature
        );

    if (nonce > request.metadata.relayMaxNonce) {
      // TODO: need to validate that client retries the same request and doesn't double-spend.
      // Note that this transaction is totally valid from the EVM's point of view

      throw new Error(
        `Relay used a tx nonce higher than requested. Requested ${request.metadata.relayMaxNonce} got ${nonce}`
      );
    }

    if (to.toLowerCase() !== this.config.relayHubAddress.toLowerCase()) {
      throw new Error('Transaction recipient must be the RelayHubAddress');
    }

    if (relayRequestAbiEncode !== data) {
      throw new Error(
        'Relay request Encoded data must be the same as Transaction data'
      );
    }

    if (relayWorker.toLowerCase() !== from.toLowerCase()) {
      throw new Error(
        'Transaction sender address must be the same as configured relayWorker address'
      );
    }

    log.info('validateRelayResponse - valid transaction response');
  }
}
