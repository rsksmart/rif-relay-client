import type { LogDescription } from 'ethers/lib/utils';
import log from 'loglevel';
import type { RelayStatus } from '../RelayProvider';

export type RelayTransactionEvents = 'TransactionRelayedButRevertedByRecipient'
  | 'TransactionRelayed'
  | 'Deployed'

export interface RelayTransactionHandler<E> {
    process: (event: E, logDescription: LogDescription) => RelayStatus
    default: () => RelayStatus
}

export const handlers = {
    TransactionRelayedButRevertedByRecipient: (recipientRejectedEvents: LogDescription) => {
        const { reason } = recipientRejectedEvents.args;
            const revertReason = (reason as string);

            return {
                relayRevertedOnRecipient: true,
                transactionRelayed: false,
                reason: revertReason
            };
    },
    TransactionRelayed: () => {
        return {
            relayRevertedOnRecipient: false,
            transactionRelayed: true
        };
    },
    Deployed: () => {
        return {
            relayRevertedOnRecipient: false,
            transactionRelayed: true
        };
    }
}

export const relayTransactionHandler: RelayTransactionHandler<RelayTransactionEvents> = {
    process (event: RelayTransactionEvents, logDescription: LogDescription) {  
      return handlers[event](logDescription);
    },
    default() {
        log.info(
            'Neither TransactionRelayed, Deployed, nor TransactionRelayedButRevertedByRecipient events found. This might be a non-enveloping transaction.'
        );

        return {
            relayRevertedOnRecipient: false,
            transactionRelayed: false,
            reason: 'Neither TransactionRelayed, Deployed, nor TransactionRelayedButRevertedByRecipient events found. This might be a non-enveloping transaction.'
        }; 
    }
  }