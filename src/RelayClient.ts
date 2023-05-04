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
  constants,
  Transaction,
  Wallet,
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
import {
  EthersError,
  getEnvelopingConfig,
  getProvider,
  HubEnvelopingTx,
  IgnoreVerifications,
  parseEthersError,
  RelayEstimation,
  RelayTxOptions,
} from './common';
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
  MISSING_REQUEST_FIELD,
} from './constants/errorMessages';
import EnvelopingEventEmitter, {
  EVENT_INIT,
  EVENT_RELAYER_RESPONSE,
  EVENT_SEND_TO_RELAYER,
  EVENT_SIGN_REQUEST,
  EVENT_VALIDATE_REQUEST,
} from './events/EnvelopingEventEmitter';
import { standardMaxPossibleGasEstimation } from './gasEstimator';
import {
  estimateInternalCallGas,
  estimateTokenTransferGas,
  getSmartWalletAddress,
  maxPossibleGasVerification,
  validateRelayResponse,
} from './utils';

const isNullOrUndefined = (value: unknown) =>
  value === null || value === undefined;

class RelayClient extends EnvelopingEventEmitter {
  private readonly _envelopingConfig: EnvelopingConfig;

  private readonly _httpClient: HttpClient;

  constructor(
    httpClient: HttpClient = new HttpClient(),
    private _relayServerUrl?: string
  ) {
    super();

    this._envelopingConfig = getEnvelopingConfig();
    this._httpClient = httpClient;
  }

  public getRelayServerUrl() {
    return this._relayServerUrl;
  }

  public get httpClient(): HttpClient {
    return this._httpClient;
  }

  private _getEnvelopingRequestDetails = async (
    envelopingRequest: UserDefinedEnvelopingRequest
  ): Promise<EnvelopingRequest> => {
    const isDeployment: boolean = isDeployRequest(
      envelopingRequest as EnvelopingRequest
    );
    const { relayData, request } = envelopingRequest;

    const { from, tokenContract } = request;

    if (!from) {
      throw new Error(MISSING_REQUEST_FIELD('from'));
    }

    if (!tokenContract) {
      throw new Error(MISSING_REQUEST_FIELD('tokenContract'));
    }

    if (!isDeployment) {
      if (!relayData?.callForwarder) {
        throw new Error(MISSING_CALL_FORWARDER);
      }

      if (!request.data) {
        throw new Error(MISSING_REQUEST_FIELD('data'));
      }

      if (!request.to) {
        throw new Error(MISSING_REQUEST_FIELD('to'));
      }
    }

    const callForwarder =
      relayData?.callForwarder ??
      this._envelopingConfig.smartWalletFactoryAddress;
    const data = request.data ?? '0x00';
    const to = request.to ?? constants.AddressZero;
    const value = envelopingRequest.request.value ?? constants.Zero;
    const tokenAmount = envelopingRequest.request.tokenAmount ?? constants.Zero;

    const { index } = request as UserDefinedDeployRequestBody;

    if (isDeployment && isNullOrUndefined(index)) {
      throw new Error('Field `index` is not defined in deploy body.');
    }

    const callVerifier: PromiseOrValue<string> =
      envelopingRequest.relayData?.callVerifier ||
      this._envelopingConfig[
        isDeployment ? 'deployVerifierAddress' : 'relayVerifierAddress'
      ];

    if (!callVerifier) {
      throw new Error('No call verifier present. Check your configuration.');
    }

    if (
      !this._relayServerUrl &&
      !this._envelopingConfig.preferredRelays.length
    ) {
      throw new Error(
        'Check that your configuration contains at least one preferred relay with url.'
      );
    }

    const gasPrice: PromiseOrValue<BigNumberish> =
      envelopingRequest.relayData?.gasPrice ||
      (await this._calculateGasPrice());

    if (!gasPrice || BigNumber.from(gasPrice).isZero()) {
      throw new Error('Could not get gas price for request');
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

    const gasLimit = await ((
      envelopingRequest.request as UserDefinedRelayRequestBody
    ).gas ??
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

    const recoverer =
      (envelopingRequest.request as DeployRequestBody).recoverer ??
      constants.AddressZero;

    const updateRelayData: EnvelopingRequestData = {
      callForwarder,
      callVerifier,
      feesReceiver: constants.AddressZero, // returns zero address and is to be completed when attempting to relay the transaction
      gasPrice,
    };

    const secondsNow = Math.round(Date.now() / 1000);
    const validUntilTime =
      request.validUntilTime ??
      secondsNow + this._envelopingConfig.requestValidSeconds;

    const tokenGas = request.tokenGas ?? constants.Zero;

    const commonRequestBody: CommonEnvelopingRequestBody = {
      data,
      from,
      nonce,
      relayHub,
      to,
      tokenAmount,
      tokenContract,
      tokenGas,
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
          relayData: updateRelayData,
        }
      : {
          request: {
            ...commonRequestBody,
            ...{
              gas: BigNumber.from(gasLimit),
            },
          },
          relayData: updateRelayData,
        };

    return completeRequest;
  };

  private async _prepareHttpRequest(
    { feesReceiver, relayWorkerAddress }: HubInfo,
    envelopingRequest: EnvelopingRequest,
    signerWallet?: Wallet
  ): Promise<EnvelopingTxRequest> {
    const {
      request: { relayHub, tokenGas },
    } = envelopingRequest;

    const provider = getProvider();

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

    const isDeployment: boolean = isDeployRequest(envelopingRequest);

    const { from, index, recoverer, to, data } = envelopingRequest.request as {
      from: string;
      index: number;
      recoverer: string;
      to: string;
      data: string;
    };

    const preDeploySWAddress = isDeployment
      ? await getSmartWalletAddress(from, index, recoverer, to, data)
      : undefined;

    const currentTokenGas = BigNumber.from(tokenGas);

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

    const updatedRelayRequest: EnvelopingRequest = {
      request: {
        ...envelopingRequest.request,
        tokenGas: newTokenGas,
      },
      relayData: {
        ...envelopingRequest.relayData,
        feesReceiver,
      },
    };

    const accountManager = AccountManager.getInstance();

    const metadata: EnvelopingMetadata = {
      relayHubAddress: await relayHub,
      signature: await accountManager.sign(updatedRelayRequest, signerWallet),
      relayMaxNonce,
    };
    const httpRequest: EnvelopingTxRequest = {
      relayRequest: updatedRelayRequest,
      metadata,
    };

    this.emit(EVENT_SIGN_REQUEST);
    log.info(
      `Created HTTP ${
        isDeployment ? 'deploy' : 'relay'
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
    envelopingRequest: UserDefinedEnvelopingRequest,
    options?: RelayTxOptions
  ): Promise<Transaction> {
    const { envelopingTx, activeRelay } = await this._getHubEnvelopingTx(
      envelopingRequest,
      options?.signerWallet
    );

    this.emit(EVENT_INIT);
    log.debug('Relay Client - Relaying transaction');
    log.debug(
      `Relay Client - Relay Hub:${envelopingTx.metadata.relayHubAddress.toString()}`
    );

    await this._verifyEnvelopingRequest(
      activeRelay.hubInfo,
      envelopingTx,
      options?.ignoreVerifications
    );

    return await this._attemptRelayTransaction(activeRelay, envelopingTx);
  }

  public async estimateRelayTransaction(
    envelopingRequest: UserDefinedEnvelopingRequest,
    options?: RelayTxOptions
  ): Promise<RelayEstimation> {
    const {
      envelopingTx,
      activeRelay: {
        managerData: { url },
      },
    } = await this._getHubEnvelopingTx(
      envelopingRequest,
      options?.signerWallet
    );

    log.debug('Relay Client - Estimating transaction');
    log.debug(
      `Relay Client - Relay Hub:${envelopingTx.metadata.relayHubAddress.toString()}`
    );

    return await this._httpClient.estimateMaxPossibleGas(
      url.toString(),
      envelopingTx
    );
  }

  private async _getHubEnvelopingTx(
    envelopingRequest: UserDefinedEnvelopingRequest,
    signerWallet?: Wallet
  ): Promise<HubEnvelopingTx> {
    const envelopingRequestDetails = await this._getEnvelopingRequestDetails(
      envelopingRequest
    );

    //FIXME we should implement the relay selection strategy
    const activeRelay = await this._getRelayServer();

    const envelopingTx = await this._prepareHttpRequest(
      activeRelay.hubInfo,
      envelopingRequestDetails,
      signerWallet
    );

    return {
      activeRelay,
      envelopingTx,
    };
  }

  private async _getRelayServer(): Promise<RelayInfo> {
    if (this._relayServerUrl) {
      return await this._getRelayInfo(this._relayServerUrl);
    }

    const { preferredRelays } = getEnvelopingConfig();

    for (const preferredRelay of preferredRelays ?? []) {
      try {
        return await this._getRelayInfo(preferredRelay);
      } catch (error) {
        log.warn('Failed to getChainInfo from hub', error);
        continue;
      }
    }

    log.error('No more hubs available to select');

    throw new Error('No more hubs available to select');
  }

  private async _getRelayInfo(relayServerUrl: string) {
    const hubInfo = await this._httpClient.getChainInfo(relayServerUrl);

    if (!hubInfo.ready) {
      throw new Error(`Hub is not ready`);
    }

    const relayHub = RelayHub__factory.connect(
      hubInfo.relayHubAddress,
      getProvider()
    );

    const managerData = await relayHub.getRelayInfo(
      hubInfo.relayManagerAddress
    );

    return {
      hubInfo,
      managerData,
    };
  }

  private async _attemptRelayTransaction(
    relayInfo: RelayInfo,
    envelopingTx: EnvelopingTxRequest
  ): Promise<Transaction> {
    try {
      const {
        managerData: { url },
        hubInfo,
      } = relayInfo;
      this.emit(EVENT_SEND_TO_RELAYER);

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

      this.emit(EVENT_RELAYER_RESPONSE, true);
      await this._broadcastTx(signedTx);

      return transaction;
    } catch (error) {
      log.error('failed attempting to relay the transaction ', error);
      this.emit(EVENT_RELAYER_RESPONSE, false);

      throw error;
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
    envelopingTx: EnvelopingTxRequest,
    ignoreVerifications?: Array<IgnoreVerifications>
  ): Promise<void> {
    this.emit(EVENT_VALIDATE_REQUEST);
    const {
      relayData: { gasPrice },
    } = envelopingTx.relayRequest;

    const maxPossibleGas = await standardMaxPossibleGasEstimation(
      envelopingTx,
      relayWorkerAddress
    );

    try {
      if (!ignoreVerifications?.includes('workerBalance')) {
        await this._verifyWorkerBalance(
          relayWorkerAddress,
          maxPossibleGas,
          gasPrice as BigNumberish
        );
      }
      if (!ignoreVerifications?.includes('verifiers')) {
        await this._verifyWithVerifiers(envelopingTx);
      }
      if (!ignoreVerifications?.includes('relayHub')) {
        await this._verifyWithRelayHub(
          relayWorkerAddress,
          envelopingTx,
          maxPossibleGas
        );
      }
    } catch (e) {
      const message = parseEthersError(e as EthersError);

      log.error('client verification failed: ', message);
      throw Error(`client verification failed: ${message}`);
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
    const {
      relayData: { gasPrice },
    } = relayRequest;

    const provider = getProvider();

    const relayHub = RelayHub__factory.connect(
      relayHubAddress.toString(),
      provider
    );

    const isDeploy = isDeployRequest(relayRequest);

    const method = isDeploy
      ? await relayHub.populateTransaction.deployCall(relayRequest, signature)
      : await relayHub.populateTransaction.relayCall(
          relayRequest as RelayRequest,
          signature
        );

    const { transactionResult } = await maxPossibleGasVerification(
      method,
      gasPrice as BigNumberish,
      maxPossibleGas,
      relayWorkerAddress
    );

    if (!isDeploy) {
      const decodedResult = relayHub.interface.decodeFunctionResult(
        'relayCall',
        transactionResult
      );

      if (!decodedResult[0]) {
        throw Error('Destination contract reverted');
      }
    }
  }
}

export default RelayClient;

export { RelayTxOptions };
