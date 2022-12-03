import type HttpClient from './api/common/HttpClient';
import {defaultHttpClient} from './api/common/HttpClient';
import type { RelayManagerData, RelayInfo } from './utils';
import config from 'config';

const ENVELOPING_CONFIG_FIELD_NAME = 'EnvelopingConfig';
const PREFERRED_RELAYS_FIELD_NAME = 'preferredRelays';

export async function selectNextRelay(
  httpClient: HttpClient = defaultHttpClient
): Promise<RelayInfo | undefined> {
  const preferredRelays: Array<RelayManagerData> = config.get(
    `${ENVELOPING_CONFIG_FIELD_NAME}.${PREFERRED_RELAYS_FIELD_NAME}`
  );

  for (const relayInfo of preferredRelays) {
    let pingResponse;

    try{
        pingResponse = await httpClient.getPingResponse(relayInfo.url);
    }catch(error){
        continue;
    }

    if (pingResponse.ready) {
      return {
        pingResponse,
        relayInfo,
      };
    }
  }

  return undefined;
}
