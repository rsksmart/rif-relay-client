import type { LogDescription } from "@ethersproject/abi";
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { RelayTransactionEvents, relayTransactionHandler } from '../../src/handlers/RelayProvider'


use(sinonChai);
use(chaiAsPromised);

describe('Handler:RelayProvider', function () {

    describe('relayTransactionhandler', function () {

        it('should handle TransactionRelayedButRevertedByRecipient', function () {

            const revertReason = 'Transaction reverted because of some reason';
            const dummyLogDescription = {
                name: 'TransactionRelayedButRevertedByRecipient',
                args: {
                  reason: revertReason
                }
            } as unknown as LogDescription
    
            const relayStatus = relayTransactionHandler.process(dummyLogDescription.name as RelayTransactionEvents, dummyLogDescription);
            
            expect(relayStatus.transactionRelayed).to.be.false;
            expect(relayStatus.relayRevertedOnRecipient).to.be.true;
            expect(relayStatus.reason).to.eq(revertReason);
        })

        it('should handle TransactionRelayed', function () {

            const dummyLogDescription = {
                name: 'TransactionRelayed',
              } as unknown as LogDescription
    
            const relayStatus = relayTransactionHandler.process(dummyLogDescription.name as RelayTransactionEvents, dummyLogDescription);
            
            expect(relayStatus.transactionRelayed).to.be.true;
            expect(relayStatus.relayRevertedOnRecipient).to.be.false;
            expect(relayStatus.reason).to.be.undefined;
        })

        it('should handle Deployed event', function () {

            const dummyLogDescription = {
                name: 'Deployed',
            } as unknown as LogDescription
    
            const relayStatus = relayTransactionHandler.process(dummyLogDescription.name as RelayTransactionEvents, dummyLogDescription);
            
            expect(relayStatus.transactionRelayed).to.be.true;
            expect(relayStatus.relayRevertedOnRecipient).to.be.false;
        })

        it('should provide a default behaviour for unsupported events', function () {

            const relayStatus = relayTransactionHandler.default();
            
            expect(relayStatus.transactionRelayed).to.be.false;
            expect(relayStatus.relayRevertedOnRecipient).to.be.false;
            expect(relayStatus.reason).to.eq('Neither TransactionRelayed, Deployed, nor TransactionRelayedButRevertedByRecipient events found. This might be a non-enveloping transaction.');
        })
    })

});
