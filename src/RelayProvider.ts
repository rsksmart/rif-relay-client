import { constants, Transaction } from 'ethers';
import type { Networkish } from "@ethersproject/networks";
import { JsonRpcProvider, TransactionReceipt } from "@ethersproject/providers";
import type { ConnectionInfo } from "@ethersproject/web";
import { getEnvelopingConfig } from './utils';
import { hexValue } from "@ethersproject/bytes";
import RelayClient, { RequestConfig } from './RelayClient';
import log from 'loglevel';
import { RelayHub__factory } from '@rsksmart/rif-relay-contracts';
import AccountManager from './AccountManager';
import type { UserDefinedEnvelopingRequest } from './common/relayRequest.types';

export interface RelayingResult {
    validUntilTime?: string;
    transaction: Transaction;
    receipt: TransactionReceipt;
}

export default class RelayProvider extends JsonRpcProvider {

    //TODO: remove & when relayTransaction PR is merged and rebased
    private readonly relayClient!: RelayClient & { relayTransaction: (
        envelopingRequest: UserDefinedEnvelopingRequest,
        requestConfig: RequestConfig) => Promise<Transaction> };
    
    private readonly jsonRpcProvider: JsonRpcProvider;

    constructor(url?: ConnectionInfo | string, network?: Networkish, relayClient = new RelayClient()){
        super(url, network);
        this.jsonRpcProvider = new JsonRpcProvider(url, network);
        //TODO: remove this when relayTransaction PR is merged and rebased
        //@ts-ignore
        this.relayClient =
            relayClient ??
            new RelayClient();
    }

    private _useEnveloping(method: string, requestConfig: RequestConfig): boolean {
        return method === 'eth_accounts' || Boolean(requestConfig.useEnveloping);
    }

    private _getRelayStatus(respResult: TransactionReceipt): {
        relayRevertedOnRecipient: boolean;
        transactionRelayed: boolean;
        reason?: string;
    } {
        if (!respResult.logs || respResult.logs.length === 0) {
            return {
                relayRevertedOnRecipient: false,
                transactionRelayed: false,
                reason: 'Tx logs not found'
            };
        }

        const relayHubInterface = RelayHub__factory.createInterface();
        const parsedLogs = respResult.logs.map(log => relayHubInterface.parseLog(log));

        const recipientRejectedEvents = parsedLogs.find(log => log.name == 'TransactionRelayedButRevertedByRecipient');

        if (recipientRejectedEvents) {
            const { reason } = recipientRejectedEvents.args;

            const revertReason = (reason as string) ?? 'Unknown';
            log.info(
                `Recipient rejected on-chain: ${revertReason}`
            );

            return {
                relayRevertedOnRecipient: true,
                transactionRelayed: false,
                reason: revertReason
            };
        }

        const transactionRelayed = parsedLogs.find(log => log.name == 'TransactionRelayed');

        if (transactionRelayed) {
            return {
                relayRevertedOnRecipient: false,
                transactionRelayed: true
            };
        }

        // Check if it wasn't a deploy call which does not emit TransactionRelayed events but Deployed events
        const deployedEvent = parsedLogs.find(log => log.name == 'Deployed');

        if (deployedEvent) {
            return {
                relayRevertedOnRecipient: false,
                transactionRelayed: true
            };
        }

        log.info(
            'Neither TransactionRelayed, Deployed, nor TransactionRelayedButRevertedByRecipient events found. This might be a non-enveloping transaction '
        );

        return {
            relayRevertedOnRecipient: false,
            transactionRelayed: false,
            reason: 'Neither TransactionRelayed, Deployed, nor TransactionRelayedButRevertedByRecipient events found. This might be a non-enveloping transaction'
        };
    }

    private async executeRelayTransaction(
        envelopingRequest: UserDefinedEnvelopingRequest,
        requestConfig: RequestConfig
    ): Promise<RelayingResult> {
        try {

            const transaction = await this.relayClient.relayTransaction(
                envelopingRequest, requestConfig
            );

            const { hash } = transaction;

            if(!hash){
                throw new Error('Transaction has no hash!');
            }
            const receipt = await this.getTransactionReceipt(hash);

            const { relayRevertedOnRecipient, reason } = this._getRelayStatus(receipt);

            if (relayRevertedOnRecipient) {
                throw new Error(
                        `Transaction Relayed but reverted on recipient - TxHash: ${hash} , Reason: ${reason ?? 'unknown'}`
                );
            }

            return {
                transaction,
                receipt,
            };
        } catch (error) {
            log.error('Rejected relayTransaction call', error);
            throw new Error(
                `Rejected relayTransaction call - Reason: ${(error as Error).message}`
            );
        }
    }

    private async _ethSendTransaction(
        envelopingRequest: UserDefinedEnvelopingRequest,
        requestConfig: RequestConfig
    ): Promise<RelayingResult> {
        const config = getEnvelopingConfig();

        const { relayData, request } = envelopingRequest;

        let callForwarderValue = relayData.callForwarder;
        let relayHubValue = request.relayHub;
        let onlyPreferredRelaysValue = requestConfig.onlyPreferredRelays;
        let gasToSend = requestConfig.forceGasPrice;

        if (
            callForwarderValue === undefined ||
            callForwarderValue === null ||
            callForwarderValue === constants.AddressZero
        ) {
            callForwarderValue = config.forwarderAddress;
        }

        if (
            relayHubValue === undefined ||
            relayHubValue === null ||
            relayHubValue === constants.AddressZero
        ) {
            relayHubValue = config.relayHubAddress;
        }

        if (
            onlyPreferredRelaysValue === undefined ||
            onlyPreferredRelaysValue === null
        ) {
            onlyPreferredRelaysValue = config.onlyPreferredRelays;
        }

        if (gasToSend !== undefined && gasToSend !== null) {
            gasToSend = hexValue(gasToSend);
        }

        /**
         * When using a RelayProvider, and the gas field is not manually set, then the original provider within calculates a ridiculously high gas.
         * In order to avoid this, we created a new field called forceGas, which is optional.
         * If the user wants to manually set the gas, then she can put a value in the forceGas field, otherwise it will be
         * automatically estimated (correctly) by the RelayClient.
         * The reason why we added this new forceGas field is because at this point, by reading the gas field,
         * we cannot differentiate between a user-entered gas value from the auto-calculated (and a very poor calculation)
         * value that comes from the original provider
         */

        const fullEnvelopingRequest: UserDefinedEnvelopingRequest = {
            relayData: {
                ...envelopingRequest.relayData,
                callForwarder: callForwarderValue,
            }, 
            request: {
                ...envelopingRequest.request,
                relayHub: relayHubValue,
                gas: gasToSend,
            }
        }

        const fullRequestConfig: RequestConfig = {
            ...requestConfig,
            onlyPreferredRelays: onlyPreferredRelaysValue
        }

        return this.executeRelayTransaction(fullEnvelopingRequest, fullRequestConfig);
    }

    private async _getAccounts(method: string, params: Array<{ requestConfig: RequestConfig, envelopingTx: UserDefinedEnvelopingRequest }>) {

        const response = await this.jsonRpcProvider.send(method, params) as { result: unknown[] };

        if (response != null && Array.isArray(response.result)) {
            const { chainId } = await this.getNetwork();
            const accountManager = new AccountManager(this, chainId);

            const ephemeralAccounts =
                accountManager.getAccounts();

            response.result = response.result.concat(ephemeralAccounts);
        }

        return response;
    }

    override send(method: string, params: Array<{ requestConfig: RequestConfig, envelopingTx: UserDefinedEnvelopingRequest }>): Promise<unknown> {

        const [ envelopingData ] = params;
        if(!envelopingData) {
            throw new Error('No data to send!');
        }

        const { requestConfig, envelopingTx: { request } } = envelopingData;

        if (this._useEnveloping(method, requestConfig)) {
            if (method === 'eth_sendTransaction') {

                if (!request.to) {
                    throw new Error(
                        'Relay Provider cannot relay contract deployment transactions. Add {from: accountWithRBTC, useEnveloping: false}.'
                    );
                }

                return this._ethSendTransaction(envelopingData.envelopingTx, requestConfig);
            }

            if (method === 'eth_getTransactionReceipt') {
                return this.jsonRpcProvider.send(method, params);
            }

            if (method === 'eth_accounts') {
                return this._getAccounts(method, params);
            }

            throw new Error(`Rif Relay unsupported method: ${ method }`);
        }

        return this.jsonRpcProvider.send(method, params);
    }
}