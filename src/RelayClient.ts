import {
  EnvelopingTypes,
  IForwarder__factory,
} from '@rsksmart/rif-relay-contracts';
import { getDefaultProvider, providers } from 'ethers';
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
    const callForwarder =
      data.callForwarder?.toString() ?? this._envelopingConfig.forwarderAddress;

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
      relayHubAddress: request.relayHub?.toString() ?? '',
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
}

export default RelayClient;

export type { RequestConfig };
