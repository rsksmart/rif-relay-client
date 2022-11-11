import { constants, getDefaultProvider, providers, utils } from 'ethers';
import { getAddress, HDNode, solidityKeccak256 } from 'ethers/lib/utils';

import { langCz as cz } from '@ethersproject/wordlists/lib/lang-cz';
import { langEn as en } from '@ethersproject/wordlists/lib/lang-en';
import { langEs as es } from '@ethersproject/wordlists/lib/lang-es';
import { langFr as fr } from '@ethersproject/wordlists/lib/lang-fr';
import { langIt as it } from '@ethersproject/wordlists/lib/lang-it';
import { langJa as ja } from '@ethersproject/wordlists/lib/lang-ja';
import { langKo as ko } from '@ethersproject/wordlists/lib/lang-ko';
import {
  langZhCn as zh_cn,
  langZhTw as zh_tw
} from '@ethersproject/wordlists/lib/lang-zh';
import type { SmartWalletFactory } from '@rsksmart/rif-relay-contracts/dist/typechain-types/contracts/factory/SmartWalletFactory';
import { ERC20__factory } from '@rsksmart/rif-relay-contracts/dist/typechain-types/factories/@openzeppelin/contracts/token/ERC20/ERC20__factory';
import { SmartWalletFactory__factory } from '@rsksmart/rif-relay-contracts/dist/typechain-types/factories/contracts/factory';

const SHA3_NULL_S =
  '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'; //TODO: verify this is the correct way to get the hash. Copied from rif-relay-common (https://github.com/rsksmart/rif-relay-common/blob/f8e4ce8d90a979f3eec55a0eb5dbd5cc742c40e3/src/Constants.ts#L18-L19)

type Account = {
  eoaAccount: string;
  swAccounts: string[];
};

type Locale = keyof typeof wordlists; //TODO: hopefully this will be added to ethers.js (https://github.com/ethers-io/ethers.js/pull/3514)

// TODO: copied from @ethersproject/wordlists/src.ts/wordlists.ts as that doesn't allow for locale type extraction. Remove (including imports) when this is fixed (https://github.com/ethers-io/ethers.js/pull/3514).
const wordlists = {
  cz,
  en,
  es,
  fr,
  it,
  ja,
  ko,
  zh: zh_cn,
  zh_cn,
  zh_tw,
} as const;

// TODO: check that the optional params have to be optional
type Config = {
  eoaGap: number;
  sWalletGap: number;
  searchBalance: boolean;
  searchNonce: boolean;
  searchTokenBalance: boolean;
  searchDeployEvents: boolean;
  network: string; //TODO: potentially restictable by program-wide config
  factory: string;
  isCustomWallet: boolean;
  mnemonicLanguage: Locale;
  recoverer: string;
  logic: string;
  logicParamsHash: string;
  reconnectionAttempts: number;
  tokens: string[];
};

const DEFAULT_DISCOVERY_CONFIG: Partial<Config> = {
  eoaGap: 20,
  sWalletGap: 20,
  searchBalance: true,
  searchNonce: true,
  searchTokenBalance: true,
  searchDeployEvents: true,
  network: 'mainnet', //FIXME: this should probably be something else. Also should be linked/mapped to the network id or address defined in program-wide config or env vars;
  mnemonicLanguage: 'en',
  recoverer: constants.AddressZero,
  tokens: [],
};

//Account discovery https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#account-discovery
const DEFAULT_DERIVATION_PATH_PURPOSE = 44;
const RSK_COIN_TYPE = 137; // src: https://github.com/satoshilabs/slips/blob/master/slip-0044.md
const RSK_TESTNET_COIN_TYPE = 37310; // src: https://github.com/rsksmart/RSKIPs/blob/master/IPs/RSKIP57.md
const DEFAULT_DERIVATION_PATH_CHANGE = 0;

const constructDerivationPath = (
  addressIdx: number,
  hardenedIdx: number,
  coinType?: number,
  isTestNet = false,
  purpose = DEFAULT_DERIVATION_PATH_PURPOSE,
  change: 0 | 1 = DEFAULT_DERIVATION_PATH_CHANGE
) => {
  return `m/${purpose}'/${
    coinType || isTestNet ? RSK_TESTNET_COIN_TYPE : RSK_COIN_TYPE
  }'/${hardenedIdx}'/${change}/${addressIdx}`;
};

const getSWAddress = (
  config: Config,
  ownerEOA: string,
  walletIndex: number,
  bytecodeHash: string
) => {
  const isCustom = config.logic && config.logicParamsHash;
  const salt = isCustom
    ? solidityKeccak256(
        ['address', 'address', 'address', 'bytes32', 'uint256'],
        [
          ownerEOA,
          config.recoverer,
          config.logic,
          config.logicParamsHash ?? SHA3_NULL_S,
          walletIndex,
        ]
      )
    : solidityKeccak256(
        ['address', 'address', 'uint256'],
        [ownerEOA, config.recoverer, walletIndex]
      );

  const data: string = solidityKeccak256(
    ['bytes1', 'address', 'bytes32', 'bytes32'],
    ['0xff', config.factory, salt, bytecodeHash]
  );

  const address = `0x${data.slice(26, data.length)}`;

  return getAddress(address);
};

const hasAccActivity = async (
  accountAddr: string,
  config: Config,
  provider: providers.Provider
) => {
  const hasBalance = (await provider.getBalance(accountAddr, 'latest')).gt(0);

  if (hasBalance) {
    return true;
  }

  const hasTx = (await provider.getTransactionCount(accountAddr, 'latest')) > 0;

  if (hasTx) {
    return true;
  }

  const hasERC20Balance = Boolean(
    config.tokens.find(async (tokenAddr: string) => {
      const erc20Contract = ERC20__factory.connect(tokenAddr, provider);
      const balance = await erc20Contract.balanceOf(accountAddr);

      return balance.gt(0);
    })
  );

  if (hasERC20Balance) {
    return true;
  }

  return false;
};

async function setupDiscovery(
  configOveride: Config,
  mnemonic: string,
  password: string | undefined
): Promise<{
  config: Config;
  hardenedNode: utils.HDNode;
  bytecodeHash: string;
  smartWalletFactory: SmartWalletFactory;
  provider: providers.Provider;
}> {
  const config = {
    ...DEFAULT_DISCOVERY_CONFIG,
    ...configOveride,
  };

  const wordlist = wordlists[config.mnemonicLanguage];
  const hardenedNode: HDNode = HDNode.fromMnemonic(
    mnemonic,
    password,
    wordlist
  );
  const provider = getDefaultProvider(config.network);

  const smartWalletFactory = SmartWalletFactory__factory.connect(
    config.factory,
    provider
  );

  const creationByteCode = await smartWalletFactory.getCreationBytecode();
  const bytecodeHash = utils.keccak256(creationByteCode);
  const logic = config.logic ?? constants.AddressZero;
  const logicParamsHash = config.logicParamsHash ?? SHA3_NULL_S;

  return {
    config: {
      ...config,
      logic,
      logicParamsHash,
    },
    hardenedNode,
    bytecodeHash,
    smartWalletFactory,
    provider,
  };
}

async function findActiveSWFor(
  eoaAddr: string,
  config: Config,
  bytecodeHash: string,
  provider: providers.Provider
) {
  let inactivityCountdown = config.sWalletGap;
  let swIndex = 0;
  let swAccounts: string[] = [];

  while (inactivityCountdown >= 0) {
    // originally <=gapLimit, but rskj rpc crashes
    const currentSWAddress = getSWAddress(
      config,
      eoaAddr,
      swIndex,
      bytecodeHash
    );

    const hasActivity = await hasAccActivity(
      currentSWAddress,
      config,
      provider
    );

    if (hasActivity) {
      swAccounts = [...swAccounts, currentSWAddress];
      inactivityCountdown = config.sWalletGap;
    } else {
      inactivityCountdown -= 1;
    }

    swIndex++;
  }

  return swAccounts;
}

const discoverAccountsFromMnemonic = async (
  configOveride: Config,
  mnemonic: string,
  password?: string
): Promise<Account[]> => {
  const { config, hardenedNode, bytecodeHash, provider } = await setupDiscovery(
    configOveride,
    mnemonic,
    password
  );

  let accounts: Account[] = [];
  let hardenedAccount = -1;
  let nextHardened = true;

  while (nextHardened) {
    hardenedAccount += 1;
    nextHardened = false;
    let inactivityCountdown = config.eoaGap;
    let eoaIndex = 0;

    while (inactivityCountdown > 0) {
      const { address: eoaAccount } = hardenedNode.derivePath(
        constructDerivationPath(eoaIndex, hardenedAccount)
      );
      const eoaActivityFound = await hasAccActivity(
        eoaAccount,
        config,
        provider
      );

      if (eoaActivityFound) {
        nextHardened = true;
        inactivityCountdown = config.eoaGap;
      }

      const swAccounts = await findActiveSWFor(
        eoaAccount,
        config,
        bytecodeHash,
        provider
      );
      
      if (swAccounts.length > 0 || eoaActivityFound) {
        nextHardened = true;
        inactivityCountdown = config.eoaGap;

        accounts = [
          ...accounts,
          {
            eoaAccount,
            swAccounts,
          },
        ];
      } else {
        inactivityCountdown -= 1;
      }
      eoaIndex++;
    }
  }

  return accounts;
};

// export const discoverAccountsFromExtendedPublicKeys = async (
//   configOverride: Config,
//   extendedPublicKeys: string[]
// ): Promise<Account[]> => {

// };

export type DiscoveryConfig = Config;
export type DiscoveredAccount = Account;

export {
  discoverAccountsFromMnemonic
};
