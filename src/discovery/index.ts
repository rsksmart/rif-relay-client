export {
  discoverAccountsFromExtendedPublicKeys,
  discoverAccountsFromMnemonic,
} from './discovery';
export type {
  Account as DiscoveredAccount,
  Config as DiscoveryConfig,
  OptionalConfig as DiscoveryOptinalConfig,
} from './utils';
export { getSWAddress as discoveryGetSWAddress, setupDiscovery } from './utils';
