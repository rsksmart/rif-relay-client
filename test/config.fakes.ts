import { Wallet } from 'ethers';
import type { EnvelopingConfig } from 'src/common/config.types';

const ENVELOPING_CONFIG: EnvelopingConfig = {
  chainId: 3,
  clientId: 3,
  deployVerifierAddress: Wallet.createRandom().address,
  forwarderAddress: Wallet.createRandom().address,
  gasPriceFactorPercent: 3,
  jsonStringifyRequest: false,
  logLevel: 3,
  maxRelayNonceGap: 3,
  methodSuffix: '',
  minGasPrice: 3,
  onlyPreferredRelays: false,
  preferredRelays: [
    'http://fake.url'
  ],
  relayHubAddress: Wallet.createRandom().address,
  relayLookupWindowBlocks: 3,
  relayLookupWindowParts: 3,
  relayTimeoutGrace: 3,
  relayVerifierAddress: Wallet.createRandom().address,
  sliceSize: 3,
  smartWalletFactoryAddress: Wallet.createRandom().address,
  requestValidSeconds: 172800
};

export { ENVELOPING_CONFIG as FAKE_ENVELOPING_CONFIG };
