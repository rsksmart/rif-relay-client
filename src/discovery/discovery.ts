import { HDNode } from '@ethersproject/hdnode';
import {
  Account,
  Config,
  findHardenedNodeActivity,
  Setup,
  setupDiscovery,
} from './utils';

const discoverAccountsFromMnemonic = async (
  configOverride: Config,
  mnemonic: string,
  password?: string
): Promise<Account[]> => {
  const setup: Setup = await setupDiscovery(configOverride, mnemonic, password);
  if (!setup.rootNode) {
    throw new Error('Could not derive hardened node from mnemonic');
  }

  let accounts: Account[] = [];
  let hardenedAccIdx = -1;
  let nextHardened = true;

  while (nextHardened) {
    hardenedAccIdx += 1;
    const discoveredAccounts = await findHardenedNodeActivity(
      setup as Required<Setup>,
      hardenedAccIdx
    );
    nextHardened = discoveredAccounts.length > 0;
    accounts = [...accounts, ...discoveredAccounts];
  }

  return accounts;
};

const discoverAccountsFromExtendedPublicKeys = async (
  configOverride: Config,
  extendedPublicKeys: string[]
): Promise<Account[]> => {
  const setup: Setup = await setupDiscovery(configOverride);

  const accounts = await Promise.all(
    extendedPublicKeys.map(async (extendedPublicKey, hardenedAccIdx) => {
      const rootNode = HDNode.fromExtendedKey(extendedPublicKey);
      const discoveredAccounts = await findHardenedNodeActivity(
        { ...setup, rootNode },
        hardenedAccIdx
      );

      return discoveredAccounts;
    })
  );

  return accounts.flat();
};

export { discoverAccountsFromMnemonic, discoverAccountsFromExtendedPublicKeys };
