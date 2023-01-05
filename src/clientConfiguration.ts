import type { providers } from "ethers";
import type { EnvelopingConfig } from "./common/config.types";

let provider: providers.Provider;
let config: EnvelopingConfig;


const getEnvelopingConfig = (): EnvelopingConfig => {
  return config;
};

const setEnvelopingConfig = (_config: EnvelopingConfig) => {
  config = _config;
}

const getProvider = () => {
  return provider;
}

const setProvider = (_provider: providers.Provider) => {
  provider = _provider;
}

export {
  getEnvelopingConfig,
  setEnvelopingConfig,
  getProvider,
  setProvider
}