/// <reference types="node" />
import { HttpProvider, TransactionReceipt } from 'web3-core';
import { PrefixedHexString, Transaction } from 'ethereumjs-tx';
import { DeployTransactionRequest, RelayTransactionRequest, EnvelopingTransactionDetails, ContractInteractor, EstimateGasParams, EnvelopingConfig } from '@rsksmart/rif-relay-common';
import { Address, PingFilter } from './types/Aliases';
import { KnownRelaysManager } from './KnownRelaysManager';
import AccountManager from './AccountManager';
import { EnvelopingDependencies } from './Configurator';
import { RelayInfo } from './types/RelayInfo';
import { EventEmitter } from 'events';
import { RelayEvent } from './RelayEvents';
export declare const GasPricePingFilter: PingFilter;
export interface RelayingAttempt {
    transaction?: Transaction;
    error?: Error;
}
export interface RelayingResult {
    transaction?: Transaction;
    pingErrors: Map<string, Error>;
    relayingErrors: Map<string, Error>;
}
export declare class RelayClient {
    readonly emitter: EventEmitter;
    readonly config: EnvelopingConfig;
    private readonly httpClient;
    protected contractInteractor: ContractInteractor;
    protected knownRelaysManager: KnownRelaysManager;
    private readonly transactionValidator;
    private readonly pingFilter;
    readonly accountManager: AccountManager;
    private initialized;
    /**
     * create a RelayClient library object, to force contracts to go through a relay.
     */
    constructor(provider: HttpProvider, configOverride: Partial<EnvelopingConfig>, overrideDependencies?: Partial<EnvelopingDependencies>);
    /**
     * register a listener for Relay events
     * @see RelayEvent and its subclasses for emitted events
     * @param handler callback function to handle events
     */
    registerEventListener(handler: (event: RelayEvent) => void): void;
    /**
     * unregister previously registered event listener
     * @param handler callback function to unregister
     */
    unregisterEventListener(handler: (event: RelayEvent) => void): void;
    private emit;
    /**
     * In case Relay Server does not broadcast the signed transaction to the network,
     * client also broadcasts the same transaction. If the transaction fails with nonce
     * error, it indicates Relay may have signed multiple transactions with same nonce,
     * causing a DoS attack.
     *
     * @param {*} transaction - actual Ethereum transaction, signed by a relay
     */
    _broadcastRawTx(transaction: Transaction): Promise<{
        hasReceipt: boolean;
        broadcastError?: Error;
        wrongNonce?: boolean;
    }>;
    _isAlreadySubmitted(txHash: string): Promise<boolean>;
    _init(): Promise<void>;
    /**
     * Can be used to get an estimate of the maximum possible gas to be used by the transaction by using
     * a linear fit.
     * It has the advangate of not requiring the user to sign the transaction in the relay calls
     * If the transaction details are for a deploy, it won't use a linear fit
     * @param transactionDetails
     * @param relayWorker
     * @returns maxPossibleGas: The maximum expected gas to be used by the transaction
     */
    estimateMaxPossibleRelayGasWithLinearFit(transactionDetails: EnvelopingTransactionDetails, relayWorker: Address): Promise<number>;
    /**
     * Can be used to get an estimate of the maximum possible gas to be used by the transaction
     * @param transactionDetails
     * @param relayWorker
     * @returns maxPossibleGas: The maximum expected gas to be used by the transaction
     */
    estimateMaxPossibleRelayGas(transactionDetails: EnvelopingTransactionDetails, relayWorker: Address): Promise<number>;
    calculateDeployCallGas(deployRequest: DeployTransactionRequest): Promise<number>;
    calculateSmartWalletRelayGas(transactionDetails: EnvelopingTransactionDetails, relayWorker: string): Promise<number>;
    _prepareFactoryGasEstimationRequest(transactionDetails: EnvelopingTransactionDetails, relayWorker: string): Promise<DeployTransactionRequest>;
    estimateTokenTransferGas(transactionDetails: EnvelopingTransactionDetails, relayWorker: Address): Promise<number>;
    getInternalCallCost(transactionDetails: EnvelopingTransactionDetails): Promise<number>;
    relayTransaction(transactionDetails: EnvelopingTransactionDetails): Promise<RelayingResult>;
    _calculateGasPrice(): Promise<PrefixedHexString>;
    _attemptRelay(relayInfo: RelayInfo, transactionDetails: EnvelopingTransactionDetails): Promise<RelayingAttempt>;
    _prepareDeployHttpRequest(relayInfo: RelayInfo, transactionDetails: EnvelopingTransactionDetails): Promise<DeployTransactionRequest>;
    _prepareRelayHttpRequest(relayInfo: RelayInfo, transactionDetails: EnvelopingTransactionDetails): Promise<RelayTransactionRequest>;
    resolveForwarder(transactionDetails: EnvelopingTransactionDetails): Address;
    getEstimateGasParams(transactionDetails: EnvelopingTransactionDetails): EstimateGasParams;
    getTransactionReceipt(transactionHash: PrefixedHexString, retries?: number, initialBackoff?: number): Promise<TransactionReceipt>;
}
export declare function _dumpRelayingResult(relayingResult: RelayingResult): string;
