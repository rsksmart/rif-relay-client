import { JsonRpcPayload, JsonRpcResponse } from 'web3-core-helpers';
import { HttpProvider } from 'web3-core';
import { RelayClient } from './RelayClient';
import { EnvelopingTransactionDetails, EnvelopingConfig } from '@rsksmart/rif-relay-common';
import { EnvelopingDependencies } from './Configurator';
import { Transaction } from 'ethereumjs-tx';
import { AccountKeypair } from './AccountManager';
import { RelayEvent } from './RelayEvents';
import { Address } from './types/Aliases';
export interface BaseTransactionReceipt {
    logs: any[];
    status: string | boolean;
}
export declare type JsonRpcCallback = (error: Error | null, result?: JsonRpcResponse) => void;
export interface ISendAsync {
    sendAsync?: any;
}
export default class RelayProvider implements HttpProvider {
    protected readonly origProvider: HttpProvider & ISendAsync;
    private readonly origProviderSend;
    protected readonly config: EnvelopingConfig;
    readonly relayClient: RelayClient;
    /**
     * create a proxy provider, to relay transaction
     * @param overrideDependencies
     * @param relayClient
     * @param origProvider - the underlying web3 provider
     * @param envelopingConfig
     */
    constructor(origProvider: HttpProvider, envelopingConfig: Partial<EnvelopingConfig>, overrideDependencies?: Partial<EnvelopingDependencies>, relayClient?: RelayClient);
    registerEventListener(handler: (event: RelayEvent) => void): void;
    unregisterEventListener(handler: (event: RelayEvent) => void): void;
    _delegateEventsApi(origProvider: HttpProvider): void;
    send(payload: JsonRpcPayload, callback: JsonRpcCallback): void;
    /**
     * Generates a Enveloping deploy transaction, to deploy the Smart Wallet of the requester
     * @param transactionDetails All the necessary information for creating the deploy request
     * from:address => EOA of the Smart Wallet owner
     * to:address => Optional custom logic address
     * data:bytes => init params for the optional custom logic
     * tokenContract:address => Token used to pay for the deployment, can be address(0) if the deploy is subsidized
     * tokenAmount:IntString => Amount of tokens paid for the deployment, can be 0 if the deploy is subsidized
     * tokenGas:IntString => Gas to be passed to the token transfer function. This was added because some ERC20 tokens (e.g, USDT) are unsafe, they use
     * assert() instead of require(). An elaborated (and quite difficult in terms of timing) attack by a user could plan to deplete their token balance between the time
     * the Relay Server makes the local relayCall to check the transaction passes and it actually submits it to the blockchain. In that scenario,
     * when the SmartWallet tries to pay with the user's USDT tokens and the balance is 0, instead of reverting and reimbursing the unused gas, it would revert and spend all the gas,
     * by adding tokeGas we prevent this attack, the gas reserved to actually execute the rest of the relay call is not lost but reimbursed to the relay worker/
     * factory:address => Address of the factory used to deploy the Smart Wallet
     * recoverer:address => Optional recoverer account/contract, can be address(0)
     * index:IntString => Numeric value used to generate several SW instances using the same paramaters defined above
     *
     * value: Not used here, only used in other scenarios where the worker account of the relay server needs to replenish balance.
     * Any value put here wont be sent to the "to" property, it won't be moved at all.
     *
     * @returns The transaction hash
     */
    deploySmartWallet(transactionDetails: EnvelopingTransactionDetails): Promise<string>;
    /**
     * @param ownerEOA EOA of the Smart Wallet onwer
     * @param recoverer Address of a recoverer account, can be smart contract. It's used in gasless tokens, can be address(0) if desired
     * @param customLogic An optional custom logic code that the wallet will proxy to as fallback, optional, can be address(0)
     * @param walletIndex Numeric value used to generate different wallet instances for the owner using the same parameters and factory
     * @param logicInitParamsHash If customLogic was defined and it needs initialization params, they are passed as abi-encoded here, do not include the function selector
     * If there are no initParams, logicInitParamsHash must not be passed, or, since (hash of empty byte array = null) must be passed as null or as zero
     */
    calculateCustomSmartWalletAddress(factory: Address, ownerEOA: Address, recoverer: Address, customLogic: Address, walletIndex: number, bytecodeHash: string, logicInitParamsHash?: string): Address;
    calculateSmartWalletAddress(factory: Address, ownerEOA: Address, recoverer: Address, walletIndex: number, bytecodeHash: string): Address;
    _ethGetTransactionReceipt(payload: JsonRpcPayload, callback: JsonRpcCallback): void;
    _ethSendTransaction(payload: JsonRpcPayload, callback: JsonRpcCallback): void;
    _convertTransactionToRpcSendResponse(transaction: Transaction, request: JsonRpcPayload): JsonRpcResponse;
    _getRelayStatus(respResult: BaseTransactionReceipt): {
        relayRevertedOnRecipient: boolean;
        transactionRelayed: boolean;
        reason: string;
    };
    _useEnveloping(payload: JsonRpcPayload): boolean;
    host: string;
    connected: boolean;
    supportsSubscriptions(): boolean;
    disconnect(): boolean;
    newAccount(): AccountKeypair;
    addAccount(keypair: AccountKeypair): void;
    _getAccounts(payload: JsonRpcPayload, callback: JsonRpcCallback): void;
    _getPayloadForRSKProvider(payload: JsonRpcPayload): JsonRpcPayload;
}
