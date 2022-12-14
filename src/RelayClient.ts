import {
  EnvelopingTypes,
  IForwarder__factory,
} from '@rsksmart/rif-relay-contracts';
import { BigNumber as BigNumberJs } from 'bignumber.js';
import { BigNumber, getDefaultProvider, providers, utils } from 'ethers';
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
  
}

export default RelayClient;

export type { RequestConfig };
