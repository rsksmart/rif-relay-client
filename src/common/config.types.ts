type OptionalEnvelopingConfig = Partial<{
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
  logLevel: number;
  clientId: number;
  requestValidSeconds: number;
  forwarderAddress: string;
}>;

type RequiredEnvelopingConfig = {
  preferredRelays: string[];
  chainId: number;
  relayHubAddress: string;
  deployVerifierAddress: string;
  relayVerifierAddress: string;
  smartWalletFactoryAddress: string;
};

type EnvelopingConfig = RequiredEnvelopingConfig &
  Required<OptionalEnvelopingConfig>;
export { EnvelopingConfig, RequiredEnvelopingConfig, OptionalEnvelopingConfig };
