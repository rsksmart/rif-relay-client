import {
  DeployVerifier__factory,
  IForwarder__factory,
  RelayHub__factory,
  RelayVerifier__factory,
  PromiseOrValue,
  IWalletFactory__factory,
} from '@rsksmart/rif-relay-contracts';
import { BigNumber as BigNumberJs } from 'bignumber.js';
import {
  BigNumber,
  BigNumberish,
  CallOverrides,
  constants,
  Transaction,
} from 'ethers';
import {
  isAddress,
  keccak256,
  parseTransaction,
  solidityKeccak256,
} from 'ethers/lib/utils';
import log from 'loglevel';
import AccountManager from './AccountManager';
import { HttpClient } from './api/common';
import { getEnvelopingConfig, getProvider } from './common';
import type { EnvelopingConfig } from './common';
import type {
  EnvelopingMetadata,
  HubInfo,
  RelayInfo,
} from './common/relayHub.types';
import type {
  CommonEnvelopingRequestBody,
  DeployRequestBody,
  EnvelopingRequest,
  EnvelopingRequestData,
  RelayRequest,
  UserDefinedDeployRequestBody,
  UserDefinedEnvelopingRequest,
  UserDefinedRelayRequestBody,
} from './common/relayRequest.types';
import { isDeployRequest } from './common/relayRequest.utils';
import type { EnvelopingTxRequest } from './common/relayTransaction.types';
import {
  MISSING_CALL_FORWARDER,
  NOT_RELAYED_TRANSACTION,
} from './constants/errorMessages';
import EnvelopingEventEmitter, {
  envelopingEvents,
} from './events/EnvelopingEventEmitter';
import { estimateRelayMaxPossibleGas } from './gasEstimator';
import {
  estimateInternalCallGas,
  estimateTokenTransferGas,
  getSmartWalletAddress,
  selectNextRelay,
  validateRelayResponse,
} from './utils';

class RelayClient extends EnvelopingEventEmitter {
  private readonly _envelopingConfig: EnvelopingConfig;

  private readonly _httpClient: HttpClient;

  constructor() {
    super();

    this._envelopingConfig = getEnvelopingConfig();
    this._httpClient = new HttpClient();
  }

  private _getEnvelopingRequestDetails = async (
    envelopingRequest: UserDefinedEnvelopingRequest
  ): Promise<EnvelopingRequest> => {
    const isDeployment: boolean = isDeployRequest(
      envelopingRequest as EnvelopingRequest
    );
    const {
      relayData: { callForwarder },
      request: { data, from, to, tokenContract },
    } = envelopingRequest;

    if (!callForwarder) {
      throw new Error(MISSING_CALL_FORWARDER);
    }

    const callVerifier: PromiseOrValue<string> =
      envelopingRequest.relayData.callVerifier ||
      this._envelopingConfig[
      isDeployment ? 'deployVerifierAddress' : 'relayVerifierAddress'
      ];

    if (!callVerifier) {
      throw new Error('No call verifier present. Check your configuration.');
    }

    const relayServerUrl = this._envelopingConfig.preferredRelays.at(0);

    if (!relayServerUrl) {
      throw new Error(
        'Check that your configuration contains at least one preferred relay with url.'
      );
    }

    const gasPrice: PromiseOrValue<BigNumberish> =
      (envelopingRequest.relayData.gasPrice ||
        (await this._calculateGasPrice()));

    if (!gasPrice || BigNumber.from(gasPrice).isZero()) {
      throw new Error('Could not get gas price for request');
    }

    if (!data) {
      throw new Error('Field `data` is not defined in request body.');
    }

    if (!from) {
      throw new Error('Field `from` is not defined in request body.');
    }

    if (!to) {
      throw new Error('Field `to` is not defined in request body.');
    }

    const value = envelopingRequest.request.value ?? constants.Zero;
    const tokenAmount = envelopingRequest.request.tokenAmount ?? constants.Zero;

    if (!tokenContract) {
      throw new Error('Field `tokenContract` is not defined in request body.');
    }

    const provider = getProvider();

    const nonce =
      (envelopingRequest.request.nonce ||
        (isDeployment
          ? await IWalletFactory__factory.connect(
            callForwarder.toString(),
            provider
          ).nonce(from)
          : await IForwarder__factory.connect(
            callForwarder.toString(),
            provider
          ).nonce())) ??
      constants.Zero;

    const relayHub =
      envelopingRequest.request.relayHub?.toString() ||
      this._envelopingConfig.relayHubAddress;

    if (!relayHub) {
      throw new Error('No relay hub address has been given or configured');
    }

    const gasLimit = await 
      ((envelopingRequest.request as UserDefinedRelayRequestBody).gas ??
      estimateInternalCallGas({
        data,
        from: callForwarder,
        to,
        gasPrice,
      }));

    if (!isDeployment && (!gasLimit || BigNumber.from(gasLimit).isZero())) {
      throw new Error(
        'Gas limit value (`gas`) is required in a relay request.'
      );
    }

    const index =
      (await (envelopingRequest.request as UserDefinedDeployRequestBody)
        .index) ?? 0;

    const recoverer =
      (envelopingRequest.request as DeployRequestBody).recoverer ??
      constants.AddressZero;

    const relayData: EnvelopingRequestData = {
      callForwarder,
      callVerifier,
      feesReceiver: constants.AddressZero, // returns zero address and is to be completed when attempting to relay the transaction
      gasPrice,
    };

    const secondsNow = Math.round(Date.now() / 1000);
    const validUntilTime =
      secondsNow + this._envelopingConfig.requestValidSeconds;

    const commonRequestBody: CommonEnvelopingRequestBody = {
      data,
      from,
      nonce,
      relayHub,
      to,
      tokenAmount,
      tokenContract,
      tokenGas: constants.Zero,
      value,
      validUntilTime,
    };

    const completeRequest: EnvelopingRequest = isDeployment
      ? {
        request: {
          ...commonRequestBody,
          ...{
            index,
            recoverer,
          },
        },
        relayData,
      }
      : {
        request: {
          ...commonRequestBody,
          ...{
            gas: BigNumber.from(gasLimit),
          },
        },
        relayData,
      };

    return completeRequest;
  };

  private async _prepareHttpRequest(
    { feesReceiver, relayWorkerAddress }: HubInfo,
    envelopingRequest: EnvelopingRequest
  ): Promise<EnvelopingTxRequest> {
    const {
      request: { relayHub, tokenGas, nonce, gas },
      relayData: { gasPrice },
    } = envelopingRequest;

    const provider = getProvider();
    const accountManager = new AccountManager();
    const relayMaxNonce =
      (await provider.getTransactionCount(relayWorkerAddress)) +
      this._envelopingConfig.maxRelayNonceGap;

    if (
      !feesReceiver ||
      feesReceiver === constants.AddressZero ||
      !isAddress(feesReceiver)
    ) {
      throw new Error('FeesReceiver has to be a valid non-zero address');
    }

    const currentTokenGas = BigNumber.from(tokenGas);

    const isDeployment: boolean = isDeployRequest(envelopingRequest);

    const { from, index, recoverer, to, data } = envelopingRequest.request as {
      from: string;
      index: number;
      recoverer: string;
      to: string;
      data: string;
    };

    const preDeploySWAddress = isDeployment
      // FIXME:
      ? await getSmartWalletAddress(from, index, recoverer, to, data)
      : undefined;

    const newTokenGas = currentTokenGas.gt(constants.Zero)
      ? currentTokenGas
      : await estimateTokenTransferGas({
        relayRequest: {
          ...envelopingRequest,
          relayData: {
            ...envelopingRequest.relayData,
            feesReceiver,
          },
        },
        preDeploySWAddress,
      });

    //TODO the stringify part is not necessary to be done here, we need to validate
    // if its need to be done prior sending it to the server
    const updatedRelayRequest = {
      request: {
        ...envelopingRequest.request,
        tokenGas: newTokenGas.toString(),
        nonce: nonce.toString(),
        gas: isDeployment ? undefined : gas?.toString(),
      },
      relayData: {
        ...envelopingRequest.relayData,
        feesReceiver,
        gasPrice: gasPrice.toString(),
      },
    } as EnvelopingRequest;

    const metadata: EnvelopingMetadata = {
      relayHubAddress: await relayHub,
      signature: await accountManager.sign(updatedRelayRequest),
      relayMaxNonce,
    };
    const httpRequest: EnvelopingTxRequest = {
      relayRequest: updatedRelayRequest,
      metadata,
    };

    this.emit(envelopingEvents['sign-request']);
    log.info(
      `Created HTTP ${isDeployment ? 'deploy' : 'relay'
      } request: ${JSON.stringify(httpRequest)}`
    );

    return httpRequest;
  }

  private async _calculateGasPrice(): Promise<BigNumber> {
    const { minGasPrice, gasPriceFactorPercent } = this._envelopingConfig;

    const provider = getProvider();

    const networkGasPrice = new BigNumberJs(
      (await provider.getGasPrice()).toString()
    );

    const gasPrice = networkGasPrice.multipliedBy(gasPriceFactorPercent + 1);

    return BigNumber.from(
      gasPrice.lt(minGasPrice) ? minGasPrice : gasPrice.toFixed(0)
    );
  }

  public async isSmartWalletOwner(
    smartWalletAddress: string,
    owner: string
  ): Promise<boolean> {
    const provider = getProvider();

    const iForwarder = IForwarder__factory.connect(
      smartWalletAddress,
      provider
    );

    return (
      (await iForwarder.getOwner()) === solidityKeccak256(['address'], [owner])
    );
  }

  public async relayTransaction(
    envelopingRequest: UserDefinedEnvelopingRequest
  ): Promise<Transaction> {
    const envelopingRequestDetails = await this._getEnvelopingRequestDetails(
      envelopingRequest
    );

    log.debug('Relay Client - Relaying transaction');
    log.debug(
      `Relay Client - Relay Hub:${envelopingRequestDetails.request.relayHub.toString()}`
    );

    let activeRelay = await selectNextRelay(this._httpClient);

    while (activeRelay) {
      const envelopingTx = await this._prepareHttpRequest(
        activeRelay.hubInfo,
        envelopingRequestDetails
      );

      if (
        await this._verifyEnvelopingRequest(activeRelay.hubInfo, envelopingTx)
      ) {
        const transaction = await this._attemptRelayTransaction(
          activeRelay,
          envelopingTx
        );

        if (transaction) {
          log.debug('Relay Client - Relayed done');

          return transaction;
        }
      }

      activeRelay = await selectNextRelay(this._httpClient);
    }

    throw Error(NOT_RELAYED_TRANSACTION);
  }

  public async estimateTransaction(
    envelopingRequest: UserDefinedEnvelopingRequest
  ) {
    const envelopingRequestDetails = await this._getEnvelopingRequestDetails(
      envelopingRequest
    );

    log.debug('Relay Client - Estimating transaction');
    log.debug(
      `Relay Client - Relay Hub:${envelopingRequestDetails.request.relayHub.toString()}`
    );

    const activeRelay = await selectNextRelay(this._httpClient);

    while (activeRelay) {
      const envelopingTx = await this._prepareHttpRequest(
        activeRelay.hubInfo,
        envelopingRequestDetails
      );

      return await this._httpClient.estimateMaxPossibleGas(
        activeRelay.managerData.url.toString(),
        envelopingTx
      );
    }

    throw Error(NOT_RELAYED_TRANSACTION);
  }

  private async _attemptRelayTransaction(
    relayInfo: RelayInfo,
    envelopingTx: EnvelopingTxRequest
  ): Promise<Transaction | undefined> {
    try {
      const {
        managerData: { url },
        hubInfo,
      } = relayInfo;
      this.emit('send-to-relayer');
      log.info(
        `attempting relay: ${JSON.stringify(
          relayInfo
        )} transaction: ${JSON.stringify(envelopingTx)}`
      );
      const signedTx = await this._httpClient.relayTransaction(
        url.toString(),
        envelopingTx
      );
      const transaction = parseTransaction(signedTx);
      validateRelayResponse(
        envelopingTx,
        transaction,
        hubInfo.relayWorkerAddress
      );
      this.emit('relayer-response');
      await this._broadcastTx(signedTx);

      return transaction;
    } catch (e) {
      log.error('failed attempting to relay the transaction ', e);

      return undefined;
    }
  }

  /**
   * In case Relay Server does not broadcast the signed transaction to the network,
   * client also broadcasts the same transaction. If the transaction fails with nonce
   * error, it indicates Relay may have signed multiple transactions with same nonce,
   * causing a DoS attack.
   *
   * @param {*} signedTx - actual Ethereum transaction, signed by a relay
   */
  private async _broadcastTx(signedTx: string): Promise<void> {
    const txHash = keccak256(signedTx);

    log.info(`broadcasting raw transaction signed by relay. TxHash: ${txHash}`);

    const provider = getProvider();

    const [txResponse, txReceipt] = await Promise.all([
      // considering mempool transactions
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
    ]);

    if (!txResponse && !txReceipt) {
      await provider.sendTransaction(signedTx);
    }
  }

  private async _verifyEnvelopingRequest(
    { relayWorkerAddress }: HubInfo,
    envelopingTx: EnvelopingTxRequest
  ): Promise<boolean> {
    this.emit('validate-request');
    const {
      relayData: { gasPrice },
    } = envelopingTx.relayRequest;

    const maxPossibleGas = await estimateRelayMaxPossibleGas(
      envelopingTx,
      relayWorkerAddress
    );

    try {
      await this._verifyWorkerBalance(
        relayWorkerAddress,
        maxPossibleGas,
        gasPrice as BigNumberish
      );
      await this._verifyWithVerifiers(envelopingTx);
      await this._verifyWithRelayHub(
        relayWorkerAddress,
        envelopingTx,
        maxPossibleGas
      );

      return true;
    } catch (e) {
      log.error('client verification failed ', (e as Error).message);

      return false;
    }
  }

  private async _verifyWorkerBalance(
    relayWorkerAddress: string,
    maxPossibleGas: BigNumberish,
    gasPrice: BigNumberish
  ): Promise<void> {
    const provider = getProvider();

    const workerBalance = await provider.getBalance(relayWorkerAddress);
    const workerBalanceAsUnitsOfGas = workerBalance.div(gasPrice);
    if (workerBalanceAsUnitsOfGas.lt(maxPossibleGas)) {
      throw new Error('Worker does not have enough balance to pay');
    }
  }

  private async _verifyWithVerifiers({
    relayRequest,
    metadata,
  }: EnvelopingTxRequest): Promise<void> {
    const { signature } = metadata;
    const {
      relayData: { callVerifier },
    } = relayRequest;

    const provider = getProvider();

    if (isDeployRequest(relayRequest)) {
      const verifier = DeployVerifier__factory.connect(
        callVerifier.toString(),
        provider
      );
      await verifier.callStatic.verifyRelayedCall(relayRequest, signature);
    } else {
      const verifier = RelayVerifier__factory.connect(
        callVerifier.toString(),
        provider
      );
      await verifier.callStatic.verifyRelayedCall(
        relayRequest as RelayRequest,
        signature
      );
    }
  }

  private async _verifyWithRelayHub(
    relayWorkerAddress: string,
    { relayRequest, metadata }: EnvelopingTxRequest,
    maxPossibleGas: BigNumber
  ): Promise<void> {
    const { signature, relayHubAddress } = metadata;
    const { gasPrice } = relayRequest.relayData;

    const provider = getProvider();

    const relayHub = RelayHub__factory.connect(
      relayHubAddress.toString(),
      provider
    );
    const commonOverrides: CallOverrides = {
      from: relayWorkerAddress,
      gasPrice,
      gasLimit: maxPossibleGas,
    };
    if (isDeployRequest(relayRequest)) {
      await relayHub.callStatic.deployCall(
        relayRequest,
        signature,
        commonOverrides
      );
    } else {
      await relayHub.callStatic.relayCall(
        relayRequest as RelayRequest,
        signature,
        commonOverrides
      );
    }
  }
}

export default RelayClient;
