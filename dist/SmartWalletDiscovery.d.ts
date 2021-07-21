/// <reference types="node" />
import { hdkey as EthereumHDKey } from 'ethereumjs-wallet';
import { HttpProvider, IpcProvider, WebsocketProvider } from 'web3-core';
export declare type AccountReaderFunction = (accountIdx: number) => Promise<string | undefined>;
export interface DiscoveredAccount {
    eoaAccount: string;
    swAccounts: string[];
}
export declare type Web3Provider = HttpProvider | IpcProvider | WebsocketProvider;
export declare enum TMnemonicLanguage {
    CZECH = 1,
    ENGLISH = 2,
    FRENCH = 3,
    ITALIAN = 4,
    JAPANESE = 5,
    KOREAN = 6,
    SIMPLIFIED_CHINESE = 7,
    SPANISH = 8,
    TRADITIONAL_CHINESE = 9
}
export interface IDiscoveryConfig {
    eoaGap?: number;
    sWalletGap?: number;
    searchBalance?: boolean;
    searchNonce?: boolean;
    searchTokenBalance?: boolean;
    searchDeployEvents?: boolean;
    isTestNet?: boolean;
    factory: string;
    isCustomWallet: boolean;
    mnemonicLanguage?: TMnemonicLanguage;
    recoverer?: string;
    logic?: string;
    logicParamsHash?: string;
    reconnectionAttempts?: number;
}
export declare class DiscoveryConfig implements IDiscoveryConfig {
    readonly eoaGap: number;
    readonly sWalletGap: number;
    readonly searchBalance: boolean;
    readonly searchNonce: boolean;
    readonly searchTokenBalance: boolean;
    readonly searchDeployEvents: boolean;
    readonly isTestNet: boolean;
    readonly factory: string;
    readonly mnemonicLanguage: TMnemonicLanguage;
    readonly recoverer: string;
    readonly logic?: string;
    readonly logicParamsHash?: string;
    readonly isCustomWallet: boolean;
    constructor(config: IDiscoveryConfig);
}
export declare class SmartWalletDiscovery {
    private web3;
    private readonly provider;
    accounts: DiscoveredAccount[];
    private readonly tokens;
    private readonly reconnectionAttempts;
    constructor(provider: Web3Provider, tokens?: string[], reconnectionAttempts?: number);
    /**
     * Discover accounts given a mnemonic and password
     * @param config
     * @param mnemonic
     * @param password
     */
    discoverAccountsFromMnemonic(config: DiscoveryConfig, mnemonic: string, password?: string): Promise<void>;
    /**
     * Discover accounts given an array of Extended Public Keys
     * @param config
     * @param extendedPublicKeys
     */
    discoverAccountsFromExtendedPublicKeys(config: DiscoveryConfig, extendedPublicKeys: string[]): Promise<void>;
    /**
     * Discover accounts using a template method
     * The integrator must define getAccountExtendedPublicKey(accountIndex:number):string
     * which should return the base58, BIP32 extended public key for that accountIndex(private keys would work as well but it is not recommended as
     * it is unnecessary)
     * This account key is the last hardened key from the path, from wich the algorithm can derive the corresponding addresses
     * @param config
     */
    discoverAccounts(config: DiscoveryConfig, accountReader?: AccountReaderFunction): Promise<void>;
    static getRootExtKeyFromMnemonic(mnemonic: string, password?: string, language?: TMnemonicLanguage): EthereumHDKey;
    getAccountExtendedPublicKey(accountIdx: number): Promise<string | undefined>;
    pubKeyToAddress(pubKey: Buffer): string;
    private sleep;
    private reconnect;
    private searchTrx;
    calculateSmartWalletAddress(ownerEOA: string, recoverer: string, walletIndex: number, factory: string, bytecodeHash: string, chainId: number): string;
    calculateCustomSmartWalletAddress(ownerEOA: string, recoverer: string, logicAddress: string, initParamsHash: string, walletIndex: number, factory: string, bytecodeHash: string, chainId: number): string;
}
