import {
  EnvelopingTypes,
  IForwarder__factory,
} from '@rsksmart/rif-relay-contracts';
import { BigNumber as BigNumberJs } from 'bignumber.js';
import { BigNumber, BigNumberish, getDefaultProvider, providers, utils } from 'ethers';
import AccountManager from './AccountManager';
import type { EnvelopingConfig } from './common/config.types';
import type { EnvelopingMetadata, HubInfo } from './common/relayHub.types';
import type {
  EnvelopingRequestData,
  RelayRequest,
  RelayRequestBody,
  UserDefinedRelayRequest,
} from './common/relayRequest.types';
import type { EnvelopingTxRequest } from './common/relayTransaction.types';
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
  smartWalletAddress?: string;
  clientId?: string; // TODO: verify utility of this parameter
  useEnveloping?: boolean;
  forceGasPrice?: string;
  forceGas?: string;
  onlyPreferredRelays?: boolean;
  ignoreTransactionReceipt?: boolean;
  retries?: number;
  initialBackoff?: number;
};

class RelayClient extends EnvelopingEventEmitter {
  private readonly _provider: providers.Provider;

  private readonly _envelopingConfig: EnvelopingConfig;

  constructor() {
    super();

    this._provider = getDefaultProvider();
    this._envelopingConfig = getEnvelopingConfig();
  }

  public _getRelayRequestDetails = async (
    // FIXME: make private
    _request: UserDefinedRelayRequest
  ): Promise<RelayRequest> => {
    return await Promise.resolve({} as EnvelopingTypes.RelayRequestStruct);
  };

  // TODO: lift the ts exception once method is used
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  private _prepareRelayHttpRequest = async (
    { feesReceiver }: HubInfo,
    { request, relayData: data }: RelayRequest
  ): Promise<EnvelopingTxRequest> => {
    const callForwarder = data.callForwarder.toString();

    if (!callForwarder) {
      throw new Error('Call forwarder must be defined.');
    }

    const forwarder = IForwarder__factory.connect(
      callForwarder,
      this._provider
    );
    const updatedRequest: RelayRequestBody = {
      ...request,
      nonce: await forwarder.nonce(),
    };

    const updatedData: EnvelopingRequestData = {
      ...data,
      callForwarder,
      feesReceiver,
    };

    const chainId = (await this._provider.getNetwork()).chainId;
    const accountManager = new AccountManager(this._provider, chainId);

    const relayMaxNonce =
      (await this._provider.getTransactionCount(callForwarder)) +
      this._envelopingConfig.maxRelayNonceGap;

    const metadata: EnvelopingMetadata = {
      relayHubAddress: request.relayHub.toString(),
      signature: await accountManager.sign({
        request: updatedRequest,
        relayData: updatedData,
      }),
      relayMaxNonce,
    };

    this.emit(envelopingEvents['sign-request']);

    return {
      relayRequest: {
        request: updatedRequest,
        relayData: updatedData,
      },
      metadata,
    };
  };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore FIXME: remove tsignore once method is consumed
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
  
  public async isSmartWalletOwner(smartWalletAddress: string, owner:string): Promise<boolean>{
    const iForwarder = IForwarder__factory.connect(smartWalletAddress, this._provider);
    if(await iForwarder.getOwner()  !== utils.solidityKeccak256(['address'], [owner])){
      return false;
    }

    return true;
  }

  public estimateInternalCallGas = async (
    { request, relayData }: EnvelopingTypes.RelayRequestStruct,
    internalEstimationCorrection: BigNumberish = INTERNAL_ESTIMATION_CORRECTION,
    addCorrection = true
  ): Promise<BigNumber> => {
    let estimation = await this._provider.estimateGas({
      from: request.from,
      to: request.to,
      gasPrice: relayData.gasPrice,
      data: request.data,
    });

    // The INTERNAL_TRANSACTION_ESTIMATE_CORRECTION is substracted because the estimation is done using web3.eth.estimateGas which
    // estimates the call as if it where an external call, and in our case it will be called internally (it's not the same cost).
    // Because of this, the estimated maxPossibleGas in the server (which estimates the whole transaction) might not be enough to successfully pass
    // the following verification made in the SmartWallet:
    // require(gasleft() > req.gas, "Not enough gas left"). This is done right before calling the destination internally
    if (estimation.gt(internalEstimationCorrection)) {
      estimation = estimation.sub(internalEstimationCorrection);
    }

    if (addCorrection) {
      estimation = this._applyGasCorrectionFactor(estimation);
    }

    return estimation;
  };

  private _applyGasCorrectionFactor(
    estimation: BigNumberish,
    esimatedGasCorrectFactor: BigNumberish = ESTIMATED_GAS_CORRECTION_FACTOR
  ): BigNumber {
    let bigEstimation = BigNumberJs(estimation.toString());
    const bigGasCorrection = BigNumberJs(esimatedGasCorrectFactor.toString());

    if (!bigGasCorrection.isEqualTo(1)) {
      bigEstimation = bigEstimation.multipliedBy(bigGasCorrection);
    }

    return BigNumber.from(bigEstimation.toFixed());
  }
  
}

export default RelayClient;

export type { RequestConfig };
