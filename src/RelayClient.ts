import { IForwarder__factory } from '@rsksmart/rif-relay-contracts';
import type { PromiseOrValue } from '@rsksmart/rif-relay-contracts/dist/typechain-types/common';
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
import { MISSING_CALL_FORWARDER } from './constants/errorMessages';
import {
  ESTIMATED_GAS_CORRECTION_FACTOR,
  INTERNAL_ESTIMATION_CORRECTION,
} from './constants/relay.const';
import EnvelopingEventEmitter, {
  envelopingEvents,
} from './events/EnvelopingEventEmitter';
import { getEnvelopingConfig } from './utils';

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
  addExternalCorrection?: boolean;
};

type TokenGasEstimationParams = Pick<
  EnvelopingRequest['request'],
  'tokenAmount' | 'tokenContract'
> &
  Pick<EnvelopingRequest['relayData'], 'gasPrice' | 'callForwarder'> &
  Pick<RequestConfig, 'isSmartWalletDeploy' | 'preDeploySWAddress'> & {
    internalTransactionEstimateCorrection?: number;
    estimatedGasCorrectionFactor?: number;
  };

type EstimateInternalGasParams = Pick<
  RelayRequestBody,
  'data' | 'to' | 'from'
> &
  Pick<EnvelopingRequestData, 'gasPrice'> &
  Pick<RequestConfig, 'internalEstimationCorrection' | 'addExternalCorrection'>;

class RelayClient extends EnvelopingEventEmitter {
  private readonly _provider: providers.Provider;

  private readonly _envelopingConfig: EnvelopingConfig;

  constructor() {
    super();

    this._provider = getDefaultProvider();
    this._envelopingConfig = getEnvelopingConfig();
  }

  public estimateTokenTransferGas = async (
    _props: TokenGasEstimationParams
  ): Promise<BigNumber> => {
    return Promise.resolve(constants.Zero);
  };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore FIXME: remove the ts ignore once the method is consumed
  private _getEnvelopingRequestDetails = async (
    envelopingRequest: UserDefinedEnvelopingRequest,
    {
      isSmartWalletDeploy,
      preDeploySWAddress,
      forceGasLimit,
      forceGasPrice,
      internalEstimationCorrection,
      addExternalCorrection: addCorrection,
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
        gasPrice,
        tokenContract,
        tokenAmount,
        callForwarder,
        isSmartWalletDeploy,
        preDeploySWAddress,
      })) ??
      constants.Zero;

    const gasLimit = await (forceGasLimit ??
      (envelopingRequest.request as UserDefinedRelayRequestBody).gas ??
      this.estimateInternalCallGas({
        data,
        from,
        to,
        gasPrice,
        internalEstimationCorrection,
        addExternalCorrection: addCorrection,
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
    internalEstimationCorrection = INTERNAL_ESTIMATION_CORRECTION,
    addExternalCorrection,
    ...estimateGasParams
  }: EstimateInternalGasParams): Promise<BigNumber> => {
    const estimation: BigNumber = await this._provider.estimateGas(
      estimateGasParams
    );
    const differenceToCorrection = estimation.sub(internalEstimationCorrection);
    const internalEstimation = differenceToCorrection.gt(0)
      ? differenceToCorrection
      : estimation;

    // The INTERNAL_TRANSACTION_ESTIMATE_CORRECTION is substracted because the estimation is done using web3.eth.estimateGas which
    // estimates the call as if it where an external call, and in our case it will be called internally (it's not the same cost).
    // Because of this, the estimated maxPossibleGas in the server (which estimates the whole transaction) might not be enough to successfully pass
    // the following verification made in the SmartWallet:
    // require(gasleft() > req.gas, "Not enough gas left"). This is done right before calling the destination internally
    return addExternalCorrection
      ? this._applyGasCorrectionFactor(internalEstimation)
      : internalEstimation;
  };

  private _applyGasCorrectionFactor(
    estimation: BigNumberish,
    esimatedGasCorrectFactor: BigNumberish = ESTIMATED_GAS_CORRECTION_FACTOR
  ): BigNumber {
    const bigGasCorrection = BigNumberJs(esimatedGasCorrectFactor.toString());
    const bigEstimation = BigNumberJs(estimation.toString()).multipliedBy(
      bigGasCorrection
    );

    return BigNumber.from(bigEstimation.toFixed());
  }
}

export default RelayClient;

export type {
  RequestConfig,
  TokenGasEstimationParams,
  EstimateInternalGasParams,
}; // FIXME: these should probably be moved to a separate file (??/??.types.ts)
