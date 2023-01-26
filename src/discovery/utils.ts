import { constants, providers } from 'ethers';
import {
  getAddress,
  HDNode,
  keccak256,
  solidityKeccak256,
} from 'ethers/lib/utils';

import { langCz as cz } from '@ethersproject/wordlists/lib/lang-cz';
import { langEn as en } from '@ethersproject/wordlists/lib/lang-en';
import { langEs as es } from '@ethersproject/wordlists/lib/lang-es';
import { langFr as fr } from '@ethersproject/wordlists/lib/lang-fr';
import { langIt as it } from '@ethersproject/wordlists/lib/lang-it';
import { langJa as ja } from '@ethersproject/wordlists/lib/lang-ja';
import { langKo as ko } from '@ethersproject/wordlists/lib/lang-ko';
import {
  langZhCn as zh_cn,
  langZhTw as zh_tw,
} from '@ethersproject/wordlists/lib/lang-zh';
import {
  ERC20__factory,
  ISmartWalletFactory__factory,
} from '@rsksmart/rif-relay-contracts';
import { getProvider } from '../common/clientConfigurator';
import { SHA3_NULL_S } from '../utils';

type Account = {
  eoaAccount: string;
  swAccounts: string[];
};

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

type Locale = keyof typeof wordlists; //TODO: hopefully this will be added to ethers.js (https://github.com/ethers-io/ethers.js/pull/3514)

type OptionalConfig = Partial<{
  eoaGap: number;
  sWalletGap: number;
  searchBalance: boolean;
  searchNonce: boolean;
  searchTokenBalance: boolean;
  searchDeployEvents: boolean;
  network: string; //TODO: potentially restictable by program-wide config
  mnemonicLanguage: Locale;
  reconnectionAttempts: number;
  tokens: string[];
  logic: string;
  logicParamsHash: string;
  recoverer: string;
}>;

type RequiredConfig = {
  factory: string;
};

// TODO: check that the optional params have to be optional
type Config = RequiredConfig & Required<OptionalConfig>;

const DEFAULT_DISCOVERY_CONFIG: Required<OptionalConfig> = {
  eoaGap: 20,
  sWalletGap: 20,
  searchBalance: true,
  searchNonce: true,
  searchTokenBalance: true,
  searchDeployEvents: true,
  network: 'mainnet', //FIXME: this should probably be something else. Also should be linked/mapped to the network id or address defined in program-wide config or env vars;
  mnemonicLanguage: 'en',
  reconnectionAttempts: 4,
  tokens: [],
  logic: constants.AddressZero,
  logicParamsHash: SHA3_NULL_S,
  recoverer: constants.AddressZero,
};

//Account discovery https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#account-discovery
const DEFAULT_DERIVATION_PATH_PURPOSE = 44;
const RSK_COIN_TYPE = 137; // src: https://github.com/satoshilabs/slips/blob/master/slip-0044.md
const RSK_TESTNET_COIN_TYPE = 37310; // src: https://github.com/rsksmart/RSKIPs/blob/master/IPs/RSKIP57.md
const DEFAULT_DERIVATION_PATH_CHANGE = 0;

type Setup = {
  config: Config;
  rootNode?: HDNode;
  bytecodeHash: string;
  smartWalletFactory: ISmartWalletFactory__factory;
  provider: providers.Provider;
};

const setupDiscovery = async (
  configOverride: RequiredConfig & OptionalConfig,
  mnemonic?: string,
  password?: string
): Promise<Setup> => {
  const config = {
    ...DEFAULT_DISCOVERY_CONFIG,
    ...configOverride,
  };

  const rootNode = mnemonic
    ? HDNode.fromMnemonic(
        mnemonic,
        password,
        wordlists[config.mnemonicLanguage]
      )
    : undefined;
  const provider = getProvider();

  const smartWalletFactory = ISmartWalletFactory__factory.connect(
    config.factory,
    provider
  );

  const creationByteCode = await smartWalletFactory.getCreationBytecode();
  const bytecodeHash = keccak256(creationByteCode);

  return {
    config,
    rootNode,
    bytecodeHash,
    smartWalletFactory,
    provider,
  };
};

const constructDerivationPath = (
  addressIdx: number,
  hardenedIdx: number,
  coinType?: number,
  isTestNet = false,
  purpose = DEFAULT_DERIVATION_PATH_PURPOSE,
  change: 0 | 1 = DEFAULT_DERIVATION_PATH_CHANGE
): `m/${string}` => {
  return `m/${purpose}'/${
    coinType || isTestNet ? RSK_TESTNET_COIN_TYPE : RSK_COIN_TYPE
  }'/${hardenedIdx}'/${change}/${addressIdx}`;
};

const getSWAddress = (
  config: Config,
  ownerEOA: string,
  walletIndex: number,
  bytecodeHash: string
): string => {
  const isCustom = !!config.logic && !!config.logicParamsHash;

  const salt = isCustom
    ? solidityKeccak256(
        ['address', 'address', 'address', 'bytes32', 'uint256'],
        [
          ownerEOA,
          config.recoverer,
          config.logic,
          config.logicParamsHash,
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

const checkHasActivity = async (
  accountAddr: string,
  config: Config,
  provider: providers.Provider
): Promise<boolean> => {
  const hasBalance = (await provider.getBalance(accountAddr, 'latest')).gt(0);

  if (hasBalance) {
    return true;
  }

  const hasTx = (await provider.getTransactionCount(accountAddr, 'latest')) > 0;

  if (hasTx) {
    return true;
  }

  const erc20Balances = await Promise.all(
    config.tokens.map((token) =>
      ERC20__factory.connect(token, provider).balanceOf(accountAddr)
    )
  );

  const hasERC20Balance = Boolean(
    erc20Balances.find((balance) => balance.gt(0))
  );

  if (hasERC20Balance) {
    return true;
  }

  return false;
};

const findHardenedNodeActivity = async (
  { config, rootNode, provider, bytecodeHash }: Required<Setup>,
  hardenedAccIdx: number
): Promise<Account[]> => {
  let accounts: Account[] = [];
  let inactivityCountdown = config.eoaGap;
  let eoaIndex = 0;

  while (inactivityCountdown) {
    const { address: eoaAccount } = rootNode.derivePath(
      constructDerivationPath(eoaIndex, hardenedAccIdx)
    );
    const eoaActivityFound = await checkHasActivity(
      eoaAccount,
      config,
      provider
    );

    const swAccounts = await findSWActivity(
      eoaAccount,
      config,
      bytecodeHash,
      provider
    );

    if (swAccounts.length || eoaActivityFound) {
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

  return accounts;
};

const findSWActivity = async (
  eoaAddr: string,
  config: Config,
  bytecodeHash: string,
  provider: providers.Provider
): Promise<string[]> => {
  let inactivityCountdown = config.sWalletGap;
  let swIndex = 0;
  let swAccounts: string[] = [];

  while (inactivityCountdown) {
    // originally <=gapLimit, but rskj rpc crashes
    const currentSWAddress = getSWAddress(
      config,
      eoaAddr,
      swIndex,
      bytecodeHash
    );

    const hasActivity = await checkHasActivity(
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
};

export type { Config, Account, Setup, OptionalConfig };
export {
  getSWAddress,
  findSWActivity,
  findHardenedNodeActivity,
  constructDerivationPath,
  setupDiscovery,
  checkHasActivity,
};
export {
  DEFAULT_DISCOVERY_CONFIG,
  DEFAULT_DERIVATION_PATH_PURPOSE,
  RSK_COIN_TYPE,
  RSK_TESTNET_COIN_TYPE,
  DEFAULT_DERIVATION_PATH_CHANGE,
};
