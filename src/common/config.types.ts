import type { RelayManagerData } from './relayHub.types';

type EnvelopingConfig = {
  preferredRelays: RelayManagerData[];
  onlyPreferredRelays: boolean;
  relayLookupWindowParts: number;
  relayLookupWindowBlocks: number;
  gasPriceFactorPercent: number;
  minGasPrice: number;
  maxRelayNonceGap: number;
  sliceSize: number;
  relayTimeoutGrace: number;
  methodSuffix: string;
  jsonStringifyRequest: boolean;
  chainId: number;
  relayHubAddress: string;
  deployVerifierAddress: string;
  relayVerifierAddress: string;
  forwarderAddress: string;
  smartWalletFactoryAddress: string;
  logLevel: number;
  clientId: number;
};
export { EnvelopingConfig };
