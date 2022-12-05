import type HttpClient from './api/common/HttpClient';
import {getDefaultHttpClient} from './api/common/HttpClient';
import type { RelayManagerData, RelayInfo } from './utils';
import config from 'config';

const ENVELOPING_CONFIG_FIELD_NAME = 'EnvelopingConfig';
const PREFERRED_RELAYS_FIELD_NAME = 'preferredRelays';

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
