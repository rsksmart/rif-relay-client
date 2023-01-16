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
import { EthersError, getEnvelopingConfig, getProvider, HubEnvelopingTx, parseEthersError, RelayEstimation } from './common';
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

const isNullOrUndefined = (value: unknown) => value === null || value === undefined;

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
      relayData,
      request,
    } = envelopingRequest;

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

    const callForwarder = relayData?.callForwarder ?? this._envelopingConfig.smartWalletFactoryAddress;
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

    const relayServerUrl = this._envelopingConfig.preferredRelays.at(0);

    if (!relayServerUrl) {
      throw new Error(
        'Check that your configuration contains at least one preferred relay with url.'
      );
    }

    const gasPrice: PromiseOrValue<BigNumberish> =
      (envelopingRequest.relayData?.gasPrice ||
        (await this.calculateGasPrice()));

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
    const validUntilTime = request.validUntilTime ??
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
    envelopingRequest: EnvelopingRequest
  ): Promise<EnvelopingTxRequest> {
    const {
      request: { relayHub, tokenGas },
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

  async calculateGasPrice(): Promise<BigNumber> {
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
    
    const { envelopingTx, activeRelay } = await this._buildHubEnvelopingTx(envelopingRequest);

    log.debug('Relay Client - Relaying transaction');
    log.debug(
      `Relay Client - Relay Hub:${envelopingTx.metadata.relayHubAddress.toString()}`
    );

    await this._verifyEnvelopingRequest(activeRelay.hubInfo, envelopingTx)

    const transaction = await this._attemptRelayTransaction(
      activeRelay,
      envelopingTx
    );

    if (transaction) {
      log.debug('Relay Client - Relayed done');

      return transaction;
    }

    throw Error(NOT_RELAYED_TRANSACTION);
  }

  public async estimateRelayTransaction(
    envelopingRequest: UserDefinedEnvelopingRequest
  ): Promise<RelayEstimation> {

    const { envelopingTx, activeRelay: { managerData: { url } } } = await this._buildHubEnvelopingTx(envelopingRequest);

    log.debug('Relay Client - Estimating transaction');
    log.debug(
      `Relay Client - Relay Hub:${envelopingTx.metadata.relayHubAddress.toString()}`
    );

    return await this._httpClient.estimateMaxPossibleGas(
      url.toString(),
      envelopingTx
    );
  }

  private async _buildHubEnvelopingTx(request: UserDefinedEnvelopingRequest): Promise<HubEnvelopingTx> {

    const envelopingRequestDetails = await this._getEnvelopingRequestDetails(
      request
    );

    //FIXME we should implement the relay selection strategy
    const activeRelay = await selectNextRelay(this._httpClient);

    const envelopingTx = await this._prepareHttpRequest(
      activeRelay.hubInfo,
      envelopingRequestDetails
    );

    return {
      activeRelay,
      envelopingTx
    };
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
  ): Promise<void> {
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
    } catch (e) {

      const message = parseEthersError(e as EthersError);

      log.error('client verification failed: ', message);
      throw Error(`client verification failed: ${message}`)
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
      const destinationCallSuccess = await relayHub.callStatic.relayCall(
        relayRequest as RelayRequest,
        signature,
        commonOverrides
      );

      if (!destinationCallSuccess) {
        throw new Error('Destination contract reverted');
      }
    }
  }
}

export default RelayClient;
