import { constants, providers } from 'ethers';
import type {
  EnvelopingConfig,
  OptionalEnvelopingConfig,
  RequiredEnvelopingConfig,
} from './config.types';

let provider: providers.Provider;
let config: EnvelopingConfig;

const GAS_PRICE_PERCENT = 0; //
const MAX_RELAY_NONCE_GAP = 3;
const DEFAULT_RELAY_TIMEOUT_GRACE_SEC = 1800;
const DEFAULT_LOOKUP_WINDOW_BLOCKS = 60000;

const DEFAULT_ENVELOPING_CONFIG: Required<OptionalEnvelopingConfig> = {
  onlyPreferredRelays: false,
  relayLookupWindowParts: 1,
  relayLookupWindowBlocks: DEFAULT_LOOKUP_WINDOW_BLOCKS,
  gasPriceFactorPercent: GAS_PRICE_PERCENT,
  minGasPrice: 60000000, // 0.06 GWei
  maxRelayNonceGap: MAX_RELAY_NONCE_GAP,
  sliceSize: 3,
  relayTimeoutGrace: DEFAULT_RELAY_TIMEOUT_GRACE_SEC,
  methodSuffix: '',
  jsonStringifyRequest: false,
  logLevel: 0,
  clientId: 1,
  requestValidSeconds: 172800,
  forwarderAddress: constants.AddressZero,
};

const getEnvelopingConfig = (): EnvelopingConfig => {
  return config;
};

const setEnvelopingConfig = (
  configOverride: RequiredEnvelopingConfig & OptionalEnvelopingConfig
) => {
  config = { ...DEFAULT_ENVELOPING_CONFIG, ...configOverride };
};

const getProvider = () => {
  return provider;
};

const setProvider = (_provider: providers.Provider) => {
  provider = _provider;
};

export { getEnvelopingConfig, setEnvelopingConfig, getProvider, setProvider };
