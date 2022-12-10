import { Wallet } from 'ethers';
import type { HubInfo } from 'src/common/relayHub.types';

const HUB_INFO: HubInfo = {
  feesReceiver: Wallet.createRandom().address,
  minGasPrice: '3',
  ready: false,
  relayHubAddress: Wallet.createRandom().address,
  relayManagerAddress: Wallet.createRandom().address,
  relayWorkerAddress: Wallet.createRandom().address,
  version: '999',
  chainId: '666',
  networkId: '333',
};

export { HUB_INFO as FAKE_HUB_INFO };
