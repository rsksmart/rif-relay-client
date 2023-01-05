export {
  discoverAccountsFromExtendedPublicKeys,
  discoverAccountsFromMnemonic,
} from './discovery';
export type {
  Account as DiscoveredAccount,
  Config as DiscoveryConfig,
} from './utils';
export { getSWAddress as discoveryGetSWAddress, setupDiscovery } from './utils';
