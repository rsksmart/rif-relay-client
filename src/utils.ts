import config from 'config';
import type { HttpClient } from './api/common';
import type { EnvelopingConfig } from './common/config.types';
import type { RelayInfo } from './common/relayHub.types';
import { ENVELOPING_ROOT } from './constants/configs';

const getEnvelopingConfig = () => {
  try {
    return config.get<EnvelopingConfig>(ENVELOPING_ROOT);
  } catch {
    throw new Error(
      `Could not read enveloping configuration. Make sure your configuration is nested under ${ENVELOPING_ROOT} key.`
    );
  }
};

const selectNextRelay = async (
  httpClient: HttpClient
): Promise<RelayInfo | undefined> => {
  const { preferredRelays } = getEnvelopingConfig();

  for (const relayInfo of preferredRelays ?? []) {
    let hubInfo;

    try {
      hubInfo = await httpClient.getChainInfo(relayInfo.url);
    } catch (error) {
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
};

export { getEnvelopingConfig, selectNextRelay };
