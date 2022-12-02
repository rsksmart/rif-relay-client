type RelayManagerData = {
  // FIXME: remove when https://github.com/rsksmart/rif-relay-client/pull/49 is merged
  manager: string;
  url: string;
  currentlyStaked: boolean;
  registered: boolean;
};

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
export { EnvelopingConfig, RelayManagerData };
