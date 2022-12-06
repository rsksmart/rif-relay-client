import type {
  DeployTransactionRequest,
  RelayTransactionRequest
} from '@rsksmart/rif-relay-common';
import type {
  HubInfo
} from '../src/common/relay.types';
import type HttpClient from './api/common/HttpClient';
import {getDefaultHttpClient} from './api/common/HttpClient';
import config from 'config';

export const isDeployTransaction = (
  req: RelayTransactionRequest | DeployTransactionRequest
) => {
  const {
    relayRequest: { request },
  } = req;

  const { recoverer } = request as { recoverer: string };

  if (recoverer) {
    return true;
  }

  return false;
};

export interface RelayManagerData {
  manager: string;
  url: string;
  currentlyStaked: boolean;
  registered: boolean;
}

// Well, I still don't like it
// Some info is known from the event, some from ping
export interface PartialRelayInfo {
  relayInfo: RelayManagerData;
  hubInfo: HubInfo;
}

export interface RelayInfo {
  hubInfo: HubInfo;
  relayInfo: RelayManagerData;
}


export interface EnvelopingTransactionDetails {
  // Added by the Web3 call stack:
  readonly from: string;
  readonly data: string;
  readonly to: string;
  readonly tokenContract?: string;
  readonly tokenAmount?: string;
  tokenGas?: string;
  readonly recoverer?: string;
  readonly index?: string;
  readonly value?: string;

  /**
   * TODO: this is horrible. Think about it some more
   * Do not set this value manually as this value will be overwritten. Use {@link forceGasPrice} instead.
   */
  gas?: string;
  gasPrice?: string;

  // Required parameters for Enveloping, but assigned later
  readonly relayHub?: string;
  readonly callForwarder?: string;
  readonly callVerifier?: string;
  readonly isSmartWalletDeploy?: boolean;
  smartWalletAddress?: string;

  readonly clientId?: string;

  // Optional parameters for RelayProvider only:
  /**
   * Set to 'false' to create a direct transaction
   */
  readonly useEnveloping?: boolean;

  /**
   * Use this to force the {@link RelayClient} to use provided gas price instead of calculated one.
   */
  readonly forceGasPrice?: string;

  /**
   * Use this to force the {@link RelayProvider} to use provided gas instead of the one estimated by the {@link RelayClient}.
   */
  readonly forceGas?: string;

  /**
   * Use this to force the RelayClient to use only the preferred relays when searching for a suitable relay server
   */
  readonly onlyPreferredRelays?: boolean;

  /**
   * Use this to wait for the transaction receipt while processing a transaction
   */
  readonly ignoreTransactionReceipt?: boolean;

  retries?: number;
  initialBackoff?: number;
}

export const ENVELOPING_CONFIG_FIELD_NAME = 'EnvelopingConfig';
export const PREFERRED_RELAYS_FIELD_NAME = 'preferredRelays';

export async function selectNextRelay(
  httpClient: HttpClient = getDefaultHttpClient()
): Promise<RelayInfo | undefined> {
  const preferredRelays: Array<RelayManagerData> = config.get(
    `${ENVELOPING_CONFIG_FIELD_NAME}.${PREFERRED_RELAYS_FIELD_NAME}`
  );

  for (const relayInfo of preferredRelays) {
    let hubInfo;

    try{
        hubInfo = await httpClient.getChainInfo(relayInfo.url);
    }catch(error){
        continue;
    }

    if (hubInfo.ready) {
      return {
        hubInfo,
        relayInfo,
      };
    }
  }

  return undefined;
}
