import type { ContractInteractor } from '@rsksmart/rif-relay-common'; // FIXME: ContractInteractor should not be used, instead implement it's functionality directly
import type { EnvelopingConfig } from '@rsksmart/rif-relay-common/dist/src';
import { BigNumber, Transaction } from 'ethers';
import log from 'loglevel';
import type { DeployRequest, RelayRequest } from './common/relayRequest.types';
import { isDeployTransaction } from './common/relayRequest.utils';
import type { EnvelopingTxRequest } from './common/relayTransaction.types';

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
    transaction: Transaction,
    relayWorker: string
  ): void {
    const {
      to: txDestination,
      from: txOrigin,
      nonce: txNonce,
      data: txData,
    } = transaction;
    const {
      metadata: { signature, relayMaxNonce },
      relayRequest,
    } = request;
    const requestMaxNonce = BigNumber.from(relayMaxNonce).toNumber();
    log.debug('validateRelayResponse - Transaction is', transaction);

    if (!txDestination) {
      throw Error('Transaction has no recipient address');
    }

    if (!txOrigin) {
      throw Error('Transaction has no signer');
    }

    const isDeploy = isDeployTransaction(request);
    const encodedEnveloping = isDeploy
      ? this.contractInteractor.encodeDeployCallABI(
          relayRequest as DeployRequest,
          signature
        )
      : this.contractInteractor.encodeRelayCallABI(
          relayRequest as RelayRequest,
          signature
        );

    if (txNonce > requestMaxNonce) {
      // TODO: need to validate that client retries the same request and doesn't double-spend.
      // Note that this transaction is totally valid from the EVM's point of view
      throw new Error(
        `Relay used a tx nonce higher than requested. Requested ${requestMaxNonce} got ${txNonce}`
      );
    }

    if (
      txDestination.toLowerCase() !== this.config.relayHubAddress.toLowerCase()
    ) {
      throw new Error('Transaction recipient must be the RelayHubAddress');
    }

    if (encodedEnveloping !== txData) {
      throw new Error(
        'Relay request Encoded data must be the same as Transaction data'
      );
    }

    if (relayWorker.toLowerCase() !== txOrigin.toLowerCase()) {
      throw new Error(
        'Transaction sender address must be the same as configured relayWorker address'
      );
    }

    log.info('validateRelayResponse - valid transaction response');
  }
}
