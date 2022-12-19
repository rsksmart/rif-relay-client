import { IForwarder__factory, PromiseOrValue } from '@rsksmart/rif-relay-contracts';
import { BigNumber as BigNumberJs } from 'bignumber.js';
import {
  BigNumber,
  BigNumberish,
  constants,
  getDefaultProvider,
  providers,
} from 'ethers';
import { isAddress, solidityKeccak256 } from 'ethers/lib/utils';
import AccountManager from './AccountManager';
import type { EnvelopingConfig } from './common/config.types';
import type { EnvelopingMetadata, HubInfo } from './common/relayHub.types';
import type {
  CommonEnvelopingRequestBody,
  DeployRequestBody,
  EnvelopingRequest,
  EnvelopingRequestData,
  RelayRequest,
  RelayRequestBody,
  UserDefinedDeployRequestBody,
  UserDefinedEnvelopingRequest,
  UserDefinedRelayRequestBody,
} from './common/relayRequest.types';
import { isDeployRequest } from './common/relayRequest.utils';
import type { EnvelopingTxRequest } from './common/relayTransaction.types';
import {
  applyGasCorrectionFactor,
  applyInternalEstimationCorrection,
  getEnvelopingConfig
} from './utils';
import EnvelopingEventEmitter, {
  envelopingEvents,
} from './events/EnvelopingEventEmitter';
import { IERC20__factory } from '@rsksmart/rif-relay-contracts';
import {
  MISSING_SMART_WALLET_ADDRESS,
  MISSING_CALL_FORWARDER,
} from './constants/errorMessages';

type RequestConfig = {
  isSmartWalletDeploy?: boolean;
  preDeploySWAddress?: string;
  clientId?: string;
  useEnveloping?: boolean;
  forceGasPrice?: string;
  forceGasLimit?: string;
  onlyPreferredRelays?: boolean;
  ignoreTransactionReceipt?: boolean;
  retries?: number;
  initialBackoff?: number;
  internalEstimationCorrection?: BigNumberish;
  estimatedGasCorrectionFactor?: BigNumberish;
};

type TokenGasEstimationParams = Pick<
  EnvelopingRequest['request'],
  'tokenAmount' | 'tokenContract'
> &
  Pick<EnvelopingRequest['relayData'], 'gasPrice' | 'callForwarder' | 'feesReceiver'> &
  Pick<RequestConfig, 'isSmartWalletDeploy' | 'preDeploySWAddress' | 'internalEstimationCorrection' | 'estimatedGasCorrectionFactor'>;

type EstimateInternalGasParams = Pick<
  RelayRequestBody,
  'data' | 'to' | 'from'
> &
  Pick<EnvelopingRequestData, 'gasPrice'> &
  Pick<RequestConfig, 'internalEstimationCorrection' | 'estimatedGasCorrectionFactor'>;

class RelayClient extends EnvelopingEventEmitter {
  private readonly _provider: providers.Provider;

  private readonly _envelopingConfig: EnvelopingConfig;

  constructor() {
    super();

    this._provider = getDefaultProvider();
    this._envelopingConfig = getEnvelopingConfig();
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore FIXME: remove the ts ignore once the method is consumed
  private _getEnvelopingRequestDetails = async (
    envelopingRequest: UserDefinedEnvelopingRequest,
    {
      isSmartWalletDeploy,
      preDeploySWAddress,
      forceGasLimit,
      forceGasPrice
    }: RequestConfig
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

    const relayServerUrl = this._envelopingConfig.preferredRelays.at(0)?.url;

    if (!relayServerUrl) {
      throw new Error(
        'Check that your configuration contains at least one preferred relay with url.'
      );
    }

    const gasPrice: PromiseOrValue<BigNumberish> =
      forceGasPrice ??
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

    const nonce =
      (envelopingRequest.request.nonce ||
        (await IForwarder__factory.connect(
          callForwarder.toString(),
          this._provider
        ).nonce())) ??
      constants.Zero;

    const relayHub =
      envelopingRequest.request.relayHub?.toString() ||
      this._envelopingConfig.relayHubAddress;

    if (!relayHub) {
      throw new Error('No relay hub address has been given or configured');
    }

    const tokenGas =
      envelopingRequest.request.tokenGas ??
      (await this.estimateTokenTransferGas({
        tokenContract,
        tokenAmount,
        feesReceiver: constants.AddressZero,
        isSmartWalletDeploy,
        preDeploySWAddress,
        callForwarder,
        gasPrice
      })) ??
      constants.Zero;

    const gasLimit = await (forceGasLimit ??
      (envelopingRequest.request as UserDefinedRelayRequestBody).gas ??
      this.estimateInternalCallGas({
        data,
        from,
        to,
        gasPrice
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

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore FIXME: remove the ts ignore once the method is consumed
  private _prepareRelayHttpRequest = async (
    { feesReceiver }: HubInfo,
    { request, relayData }: RelayRequest
  ): Promise<EnvelopingTxRequest> => {
    const { callForwarder } = relayData;
    const { relayHub: relayHubAddress } = request;

    if (!callForwarder) {
      throw new Error('Call forwarder must be defined.');
    }

    if (
      !feesReceiver ||
      feesReceiver === constants.AddressZero ||
      !isAddress(feesReceiver)
    ) {
      throw new Error('FeesReceiver has to be a valid non-zero address');
    }

    const updatedData: EnvelopingRequestData = {
      ...relayData,
      feesReceiver,
    };

    const chainId = (await this._provider.getNetwork()).chainId;
    const accountManager = new AccountManager(this._provider, chainId);

    const relayMaxNonce =
      (await this._provider.getTransactionCount(callForwarder)) +
      this._envelopingConfig.maxRelayNonceGap;

    const metadata: EnvelopingMetadata = {
      signature: await accountManager.sign({
        request,
        relayData: updatedData,
      }),
      relayHubAddress,
      relayMaxNonce,
    };

    this.emit(envelopingEvents['sign-request']);

    return {
      relayRequest: {
        request,
        relayData: updatedData,
      },
      metadata,
    };
  };

  private _calculateGasPrice = async (): Promise<BigNumber> => {
    const { minGasPrice, gasPriceFactorPercent } = this._envelopingConfig;

    const bigMinGasPrice = BigNumberJs(minGasPrice);
    const bigGasPriceFactorPercent = BigNumberJs(gasPriceFactorPercent);
    const networkGasPrice = await this._provider.getGasPrice();
    const bigNetworkPrice = BigNumberJs(networkGasPrice.toString());

    const gasPrice = bigNetworkPrice.multipliedBy(
      bigGasPriceFactorPercent.plus(1)
    );

    if (gasPrice.lt(bigMinGasPrice)) {
      return BigNumber.from(bigMinGasPrice.toFixed());
    }

    return BigNumber.from(gasPrice.toFixed());
  };

  public async isSmartWalletOwner(
    smartWalletAddress: string,
    owner: string
  ): Promise<boolean> {
    const iForwarder = IForwarder__factory.connect(
      smartWalletAddress,
      this._provider
    );

    return (
      (await iForwarder.getOwner()) === solidityKeccak256(['address'], [owner])
    );
  }

  public estimateInternalCallGas = async ({
    internalEstimationCorrection,
    estimatedGasCorrectionFactor,
    ...estimateGasParams
  }: EstimateInternalGasParams): Promise<BigNumber> => {
    let estimation: BigNumber = await this._provider.estimateGas(
      estimateGasParams
    );

    estimation = applyInternalEstimationCorrection(estimation, internalEstimationCorrection);

    return applyGasCorrectionFactor(estimation, estimatedGasCorrectionFactor);
  };


  public async estimateTokenTransferGas(
    {
      internalEstimationCorrection,
      estimatedGasCorrectionFactor,
      tokenContract,
      tokenAmount,
      feesReceiver,
      isSmartWalletDeploy,
      preDeploySWAddress,
      callForwarder,
      gasPrice,
    }: TokenGasEstimationParams
  ): Promise<BigNumber> {

    if (
      tokenContract === constants.AddressZero ||
      tokenAmount.toString() === '0'
    ) {
      return constants.Zero;
    }

    let tokenOrigin: string | undefined;

    if (isSmartWalletDeploy) {
      tokenOrigin = preDeploySWAddress;

      // If it is a deploy and tokenGas was not defined, then the smartwallet address
      // is required to estimate the token gas. This value should be calculated prior to
      // the call to this function
      if (!tokenOrigin || tokenOrigin === constants.AddressZero) {
        throw Error(MISSING_SMART_WALLET_ADDRESS);
      }
    } else {
      tokenOrigin = callForwarder.toString();

      if (tokenOrigin === constants.AddressZero) {
        throw Error(MISSING_CALL_FORWARDER);
      }
    }

    const erc20 = IERC20__factory.connect(tokenContract.toString(), this._provider);
    const gasCost = await erc20.estimateGas.transfer(
      feesReceiver,
      tokenAmount,
      { from: tokenOrigin, gasPrice }
    );

    const internalCallCost = applyInternalEstimationCorrection(gasCost, internalEstimationCorrection);

    return applyGasCorrectionFactor(internalCallCost, estimatedGasCorrectionFactor);
  }



}

export default RelayClient;

export type {
  RequestConfig,
  TokenGasEstimationParams,
  EstimateInternalGasParams,
}; // FIXME: these should probably be moved to a separate file (??/??.types.ts)
