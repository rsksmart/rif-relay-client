/// <reference types="@openeth/truffle-typings" />
import { DeployRequest, RelayRequest, DeployTransactionRequest, RelayMetadata, RelayTransactionRequest, EnvelopingConfig, TypedRequestData } from '@rsksmart/rif-relay-common';
import { RelayingAttempt } from './RelayClient';
import { EnvelopingDependencies } from './Configurator';
import { Address, IntString } from './types/Aliases';
import { PrefixedHexString } from 'ethereumjs-tx';
import { DiscoveryConfig, AccountReaderFunction, DiscoveredAccount } from './SmartWalletDiscovery';
import Web3 from 'web3';
export interface SignatureProvider {
    sign: (dataToSign: TypedRequestData) => PrefixedHexString;
    verifySign: (signature: PrefixedHexString, dataToSign: TypedRequestData, request: RelayRequest | DeployRequest) => boolean;
}
export default class Enveloping {
    config: EnvelopingConfig;
    relayWorkerAddress: Address;
    dependencies: EnvelopingDependencies;
    private initialized;
    constructor(_config: EnvelopingConfig, _web3: Web3, _relayWorkerAddress: Address);
    _init(): Promise<void>;
    /**
     * creates a deploy request
     * @param from - sender's wallet address (EOA)
     * @param tokenContract - the token the user will use to pay to the Worker for deploying the SmartWallet
     * @param tokenAmount - the token amount the user will pay for the deployment, zero if the deploy is subsidized
     * @param tokenGas - gas limit of the token payment
     * @param  gasPrice - optional: if not set the gasPrice is calculated internally
     * @param  index - optional: allows the user to create multiple SmartWallets
     * @param  recoverer optional: This SmartWallet instance won't have recovery support
     * @return a deploy request structure.
     */
    createDeployRequest(from: Address, tokenContract: Address, tokenAmount: IntString, tokenGas: IntString, gasPrice?: IntString, index?: IntString, recoverer?: IntString): Promise<DeployRequest>;
    /**
     * Estimates the gas that needs to be put in the RelayRequest's gas field
     * @param forwarder the smart wallet address
     * @param to the destination contract address
     * @param gasPrice the gasPrice to use in the transaction
     * @param data the ABI-encoded method to call in the destination contract
     * @param addCushion if true, it adds a cushion factor (if configured in the environment)
     * @returns The estimated value in gas units
     */
    estimateDestinationContractInternalCallGas(forwarder: Address, to: Address, data: PrefixedHexString, gasPrice?: IntString, addCushion?: boolean): Promise<number>;
    /**
     * creates a relay request
     * @param from - sender's wallet address (EOA)
     * @param to - recipient contract
     * @param forwarder - smart wallet address forwarding the relay request
     * @param data - payload for the execution (e.g. encoded call when invoking an smart contract)
     * @param gasLimit - gas limit of the relayed transaction
     * @param tokenContract - the token the user will use to pay to the Worker for relaying
     * @param tokenAmount - the token amount the user will pay for relaying, zero if the call is subsidized
     * @param tokenGas - gas limit of the token payment
     * @param  gasPrice - optional: if not set, the gasPrice is calculated internally
     * @return a relay request structure.
     */
    createRelayRequest(from: Address, to: Address, forwarder: Address, data: PrefixedHexString, tokenContract: Address, tokenAmount: IntString, tokenGas: IntString, gasLimit?: IntString, gasPrice?: IntString): Promise<RelayRequest>;
    /**
     * signs a deploy request and verifies if it's correct.
     * @param signatureProvider - provider provided by the developer
     * @param request - A deploy request
     * @return signature of a deploy request
     */
    signDeployRequest(signatureProvider: SignatureProvider, request: DeployRequest): PrefixedHexString;
    /**
     * signs a relay request and verifies if it's correct.
     * @param signatureProvider - provider provided by the developer
     * @param request - A relay request
     * @return signature of a relay request
     */
    signRelayRequest(signatureProvider: SignatureProvider, request: RelayRequest): PrefixedHexString;
    signAndVerify(signatureProvider: SignatureProvider, dataToSign: TypedRequestData, request: RelayRequest | DeployRequest): PrefixedHexString;
    /**
     * creates a deploy transaction request ready for sending through http
     * @param signature - the signature of a deploy request
     * @param deployRequest - the signed deploy request
     * @return a deploy transaction request
     */
    generateDeployTransactionRequest(signature: PrefixedHexString, deployRequest: DeployRequest): Promise<DeployTransactionRequest>;
    /**
     * creates a realy transaction request ready for sending through http
     * @param signature - the signature of a relay request
     * @param relayRequest - the signed relay request
     * @return a relay transaction request
     */
    generateRelayTransactionRequest(signature: PrefixedHexString, relayRequest: RelayRequest): Promise<RelayTransactionRequest>;
    generateMetadata(signature: PrefixedHexString): Promise<RelayMetadata>;
    getSenderNonce(sWallet: Address): Promise<IntString>;
    getFactoryNonce(factoryAddr: Address, from: Address): Promise<IntString>;
    /**
     * sends the request to the relay server.
     * @param relayUrl - the relay server's url e.g. http:localhost:8090
     * @param request - the request ready to send through http
     * @return transaction hash if the sending process was correct, otherwise the error
     */
    sendTransaction(relayUrl: string, request: DeployTransactionRequest | RelayTransactionRequest): Promise<RelayingAttempt>;
    /**
     * Discovers all EOA accounts and their associated Smart Wallet accounts
     * @param config - Configuration for running the Discovery Algorithm
     * @param provider - Web3 Provider to use when connecting to the node via RPC
     * @param mnemonic - Mnemonic phrase from where to recover the account addresses
     * @param password - If the Mnemonic is password protected, it must be passed
     * @param supportedTokens - List of tokens to use when searching for accounts' token activity
     * @returns - List of discovered accounts, discoveredAccount.eoaAccount contains the discovered EOA and discoveredAccount.swAccounts all the discovered Smart Wallets for that EOA
     */
    static discoverAccountsUsingMnemonic(config: DiscoveryConfig, provider: provider, mnemonic: string, password?: string, supportedTokens?: Address[]): Promise<DiscoveredAccount[]>;
    /**
     * Discovers all EOA accounts and their associated Smart Wallet accounts given a predefined list of extended public keys
     * @param config - Configuration for running the Discovery Algorithm
     * @param extendedPublicKeys - List of extended public keys representing the Accounts (last hardened key from the path) from which to derive the account addresses.
     * e.g, for RSK Mainnet it would be the list of keys of the path m/44'/137'/accountIdx'/0 where accountIdx is a numeric value indicating the index of the account key, if the array would
     * contain Accounts 0 and 1, it must have an array with the extended public keys of  m/44'/137'/0'/0 and  m/44'/137'/1'/0
     * @param provider - Web3 Provider to use when connecting to the node via RPC
     * @param supportedTokens - List of tokens to use when searching for accounts' token activity
     * @returns - List of discovered accounts, discoveredAccount.eoaAccount contains the discovered EOA and discoveredAccount.swAccounts all the discovered Smart Wallets for that EOA
     */
    static discoverAccountsFromExtendedPublicKeys(config: DiscoveryConfig, provider: provider, extendedPublicKeys: string[], supportedTokens?: Address[]): Promise<DiscoveredAccount[]>;
    /**
     * Discovers all EOA accounts and their associated Smart Wallet accounts given a reader function that will fetch the next extended public key to use
     * @param config - Configuration for running the Discovery Algorithm
     * @param accountReader - The reader function. Given an accountIdx:number it should return the next extended public key to use. If the function is
     * left undefined, then it is expected from the library integrator to implement SmartWalletDiscovery::getAccountExtendedPublicKey; otherwise the
     * discovery algorithm won't find any accounts
     * @param provider - Web3 Provider to use when connecting to the node via RPC
     * @param supportedTokens - List of tokens to use when searching for accounts' token activity
     * @returns - List of discovered accounts, discoveredAccount.eoaAccount contains the discovered EOA and discoveredAccount.swAccounts all the discovered Smart Wallets for that EOA
     */
    static discoverAccounts(config: DiscoveryConfig, provider: provider, accountReader?: AccountReaderFunction, supportedTokens?: Address[]): Promise<DiscoveredAccount[]>;
}
