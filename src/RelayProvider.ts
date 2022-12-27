import { constants } from 'ethers';
import type { Networkish } from "@ethersproject/networks";
import { JsonRpcProvider, TransactionReceipt, TransactionResponse } from "@ethersproject/providers";
import type { ConnectionInfo } from "@ethersproject/web";
import { getEnvelopingConfig } from './utils';
import { hexValue } from "@ethersproject/bytes";
import type EnvelopingTransactionDetails from '@rsksmart/rif-relay-common/dist/types/EnvelopingTransactionDetails';
import RelayClient from './RelayClient';
import log from 'loglevel';
import { RelayHub__factory } from '@rsksmart/rif-relay-contracts';
import AccountManager from './AccountManager';

export interface RelayingResult {
    validUntilTime?: string;
    transaction?: TransactionResponse;
    receipt?: TransactionReceipt;
    pingErrors: Map<string, Error>;
    relayingErrors: Map<string, Error>;
}

export default class RelayProvider extends JsonRpcProvider {

    private readonly relayClient!: RelayClient;

    constructor(url?: ConnectionInfo | string, network?: Networkish, relayClient?: RelayClient){
        super(url, network);
        this.relayClient =
            relayClient ??
            new RelayClient();
    }

    private _useEnveloping(payload: { method: string, params: Array<EnvelopingTransactionDetails> }): boolean {
        if (payload.method === 'eth_accounts') {
            return true;
        }
        if (payload.params[0] === undefined) {
            return false;
        }
        const [transactionDetails] = payload.params;

        return transactionDetails.useEnveloping ?? false;
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


    private async processTransactionReceipt(
        txHash: string,
        //retries: number,
        //initialBackoff: number
    ): Promise<TransactionReceipt> {
        // Will this be implemented?
        //const receipt = this.relayClient.getTransactionReceipt(txHash, retries, initialBackoff);
        const receipt = await this.getTransactionReceipt(txHash);
        const relayStatus = this._getRelayStatus(receipt);
        if (relayStatus.relayRevertedOnRecipient && relayStatus.reason) {
            throw new Error(
                `Transaction Relayed but reverted on recipient - TxHash: ${txHash} , Reason: ${relayStatus.reason}`
            );
        }

        return receipt;
    }

    private async executeRelayTransaction(
        transactionDetails: EnvelopingTransactionDetails
    ): Promise<RelayingResult> {
        try {
            //const relayingResult = await this.relayClient.relayTransaction(
            //    transactionDetails
            //);

            const relayingResult = {} as RelayingResult;

            if (
                relayingResult.transaction !== undefined &&
                relayingResult.transaction !== null
            ) {

                const { hash } = relayingResult.transaction;

                if (!transactionDetails.ignoreTransactionReceipt) {
                    //const { retries, initialBackoff } = transactionDetails;
                    const receipt: TransactionReceipt =
                        await this.processTransactionReceipt(
                            hash,
                            //retries,
                            //initialBackoff
                        );
                    relayingResult.receipt = receipt;
                }

                return relayingResult;
            } else {
                //const message = `Failed to relay call. Results:\n${_dumpRelayingResult(
                //    relayingResult
                //)}`;

                const message = 'Failed to relay call';

                log.error(message);
                throw new Error(message);
            }
        } catch (error) {
            const reasonStr =
                error instanceof Error ? error.message : JSON.stringify(error);
            log.info('Rejected relayTransaction call', error);
            throw new Error(
                `Rejected relayTransaction call - Reason: ${reasonStr}`
            );
        }
    }

    private async _ethSendTransaction(
        params: Array<EnvelopingTransactionDetails>
    ) {
        const config = getEnvelopingConfig();
        let transactionDetails = params[0];

        if(!transactionDetails){
            throw new Error('No transaction details');
        }

        let callForwarderValue = transactionDetails.callForwarder;
        let relayHubValue = transactionDetails.relayHub;
        let onlyPreferredRelaysValue = transactionDetails.onlyPreferredRelays;
        let gasToSend = transactionDetails.forceGas;

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
        transactionDetails = {
            ...transactionDetails,
            callForwarder: callForwarderValue,
            relayHub: relayHubValue,
            onlyPreferredRelays: onlyPreferredRelaysValue,
            gas: gasToSend // it is either undefined or a user-entered value
        };

        const relayingResult = await this.executeRelayTransaction(transactionDetails);
        const { transaction, receipt } = relayingResult;

        if(!transaction) {
            throw new Error('No transaction found!');
        }

        if(!receipt) {
            throw new Error('No Tx receipt found!');
        }

        const { hash } = transaction;
        const { relayRevertedOnRecipient, reason } = this._getRelayStatus(receipt);

        if (relayRevertedOnRecipient) {
            throw new Error(
                    `Transaction Relayed but reverted on recipient - TxHash: ${hash} , Reason: ${reason ?? 'unknown'}`
            );
        }

        return relayingResult;
    }

    private async _getAccounts(method: string, params: Array<EnvelopingTransactionDetails>) {

        const response = await this.send(method, params) as { result: unknown[] };

        if (response != null && Array.isArray(response.result)) {
            const { chainId } = await this.getNetwork();
            const accountManager = new AccountManager(this, chainId);

            const ephemeralAccounts =
                accountManager.getAccounts();

            response.result = response.result.concat(ephemeralAccounts);
        }

        return response;
    }

    override send(method: string, params: Array<EnvelopingTransactionDetails>): Promise<unknown> {

        if (this._useEnveloping({ method, params })) {
            if (method === 'eth_sendTransaction') {
                const [ firstElement ] = params;

                if(!firstElement){
                    throw new Error('No data');
                }

                if (!firstElement.to) {
                    throw new Error(
                        'Relay Provider cannot relay contract deployment transactions. Add {from: accountWithRBTC, useEnveloping: false}.'
                    );
                }

                return this._ethSendTransaction(params);
            }

            if (method === 'eth_getTransactionReceipt') {
                return this.send(method, params);
            }

            if (method === 'eth_accounts') {
                return this._getAccounts(method, params);
            }

            throw new Error(`Rif Relay unsupported method: ${ method }`);
        }

        return this.send(method, params);
    }
}