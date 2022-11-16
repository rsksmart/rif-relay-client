import { expect, use } from 'chai';
import sinonChai from 'sinon-chai'
import { createSandbox, SinonStubbedInstance } from 'sinon';
import RelayedTransactionValidator from '../src/RelayedTransactionValidator';
import ContractInteractor from '@rsksmart/rif-relay-common/dist/src/ContractInteractor';
import chaiAsPromised from 'chai-as-promised';
import type { DeployTransactionRequest, EnvelopingConfig } from '@rsksmart/rif-relay-common/dist/src';
import { BigNumber, Transaction, Wallet } from 'ethers';

use(sinonChai);
use(chaiAsPromised);

const sandbox = createSandbox();
const createRandomAddress = () => Wallet.createRandom().address;

describe('RelayedTransactionValidator', function () {

    describe('constructor', function(){

        after(function () {
            sandbox.restore();
        });

        afterEach(function () {
            sandbox.restore();
        });

        it('Should store ContractInteractor and Config', function () {

            const contractInteractor = sandbox.createStubInstance(
                ContractInteractor
            );

            const envelopingConfig: EnvelopingConfig = {
                chainId: 33,
                clientId: '',
                deployVerifierAddress: '',
                forwarderAddress: '',
                gasPriceFactorPercent: 0.02,
                relayVerifierAddress: '',
                relayHubAddress: '',
                smartWalletFactoryAddress: '',
                sliceSize: 0,
                relayTimeoutGrace: 0,
                relayLookupWindowParts: 0,
                relayLookupWindowBlocks: 0,
                maxRelayNonceGap: 0,
                minGasPrice: 0,
                methodSuffix: '',
                preferredRelays: [],
                onlyPreferredRelays: true,
                jsonStringifyRequest: true,
                logLevel: 0
            }

            const relayedTransactionValidator = new RelayedTransactionValidator(contractInteractor, envelopingConfig);
            expect(relayedTransactionValidator).to.be.instanceOf(RelayedTransactionValidator);
        });
    })

    describe('validateRelayResponse', function() {

        let contractInteractor: SinonStubbedInstance<ContractInteractor>;
        let deployRequest: DeployTransactionRequest;
        let relayedTransactionValidator: RelayedTransactionValidator;
        let relayWorkerAddress: string;
        let relayHubAddress: string;
        beforeEach(function () {
            relayWorkerAddress = createRandomAddress();
            relayHubAddress = createRandomAddress();

            deployRequest = {
                metadata: {
                    relayHubAddress,
                    relayMaxNonce: 6,
                    signature: ''
                },
                relayRequest: {
                    relayData: {
                        callForwarder: '',
                        callVerifier: '',
                        feesReceiver: '',
                        gasPrice: ''
                    },
                    request: {
                        from: '',
                        to: '',
                        index: 0,
                        nonce: 0,
                        recoverer: createRandomAddress(),
                        relayHub: '',
                        tokenAmount: 0,
                        tokenContract: '',
                        tokenGas: 0,
                        value: 0,
                        data: ''
                    }
                }
            }

            const envelopingConfig: EnvelopingConfig = {
                chainId: 33,
                clientId: '',
                deployVerifierAddress: '',
                forwarderAddress: '',
                gasPriceFactorPercent: 0.02,
                relayVerifierAddress: '',
                relayHubAddress,
                smartWalletFactoryAddress: '',
                sliceSize: 0,
                relayTimeoutGrace: 0,
                relayLookupWindowParts: 0,
                relayLookupWindowBlocks: 0,
                maxRelayNonceGap: 0,
                minGasPrice: 0,
                methodSuffix: '',
                preferredRelays: [],
                onlyPreferredRelays: true,
                jsonStringifyRequest: true,
                logLevel: 0
            }

            contractInteractor = sandbox.createStubInstance(
                ContractInteractor
            );
            relayedTransactionValidator = new RelayedTransactionValidator(contractInteractor, envelopingConfig);
        })

        afterEach(function () {
            sandbox.restore();
        });

        it('Should perform checks on deploy transaction and not throw errors', function () {
            
            const transaction: Transaction = {
                nonce: 5,
                chainId: 33,
                data: 'Dummy Data',
                gasLimit: BigNumber.from(0),
                value: BigNumber.from(0),
                to: relayHubAddress,
                from: relayWorkerAddress
            }
            
            contractInteractor.encodeDeployCallABI.returns('Dummy Data');
            expect(relayedTransactionValidator.validateRelayResponse(deployRequest, transaction, relayWorkerAddress)).to.not.throw;
        });
        
        it('Should perform checks on relay transaction and not throw errors', function () {
            const transaction: Transaction = {
                nonce: 5,
                chainId: 33,
                data: 'Dummy Data',
                gasLimit: BigNumber.from(0),
                value: BigNumber.from(0),
                to: relayHubAddress,
                from: relayWorkerAddress
            }

            const { metadata, relayRequest: { relayData, request } } = deployRequest;
            const relayRequest = {
                metadata,
                relayRequest: {
                    relayData,
                    request: {
                        ...request,
                        recoverer: ''
                    }
                }
            }

            contractInteractor.encodeRelayCallABI.returns('Dummy Data');
            expect(relayedTransactionValidator.validateRelayResponse(relayRequest, transaction, relayWorkerAddress));
        });

        it('Should throw error if transaction has no recipient address', function () {
            const transaction: Transaction = {
                nonce: 7,
                chainId: 33,
                data: 'Dummy Data',
                gasLimit: BigNumber.from(0),
                value: BigNumber.from(0),
                to: undefined,
                from: relayWorkerAddress
            }

            expect(() => relayedTransactionValidator.validateRelayResponse(deployRequest, transaction, relayWorkerAddress))
                .to
                .throw(`Transaction has no recipient address`);
        });

        it('Should throw error if transaction has no sender address', function () {
            const transaction: Transaction = {
                nonce: 7,
                chainId: 33,
                data: 'Dummy Data',
                gasLimit: BigNumber.from(0),
                value: BigNumber.from(0),
                to: relayHubAddress,
                from: undefined
            }

            expect(() => relayedTransactionValidator.validateRelayResponse(deployRequest, transaction, relayWorkerAddress))
                .to
                .throw(`Transaction has no signer`);
        });
        
        it('Should throw error if nonce is greater than relayMaxNonce', function () {
            const transaction: Transaction = {
                nonce: 7,
                chainId: 33,
                data: 'Dummy Data',
                gasLimit: BigNumber.from(0),
                value: BigNumber.from(0),
                to: relayHubAddress,
                from: relayWorkerAddress
            }

            expect(() => relayedTransactionValidator.validateRelayResponse(deployRequest, transaction, relayWorkerAddress))
                .to
                .throw(`Relay used a tx nonce higher than requested. Requested ${deployRequest.metadata.relayMaxNonce} got ${transaction.nonce}`);
        });

        it('Should throw error if Transaction recipient is not the RelayHubAddress', function () {
            const transaction: Transaction = {
                nonce: 5,
                chainId: 33,
                data: 'Dummy Data',
                gasLimit: BigNumber.from(0),
                value: BigNumber.from(0),
                to: 'Dummy Address',
                from: relayWorkerAddress
            }

            expect(() => relayedTransactionValidator.validateRelayResponse(deployRequest, transaction, relayWorkerAddress))
                .to
                .throw(`Transaction recipient must be the RelayHubAddress`);
        });

        it('Should throw error if Relay request Encoded data is not the same as Transaction data', function () {
            const transaction: Transaction = {
                nonce: 5,
                chainId: 33,
                data: 'Dummy Data',
                gasLimit: BigNumber.from(0),
                value: BigNumber.from(0),
                to: relayHubAddress,
                from: relayWorkerAddress
            }

            expect(() => relayedTransactionValidator.validateRelayResponse(deployRequest, transaction, relayWorkerAddress))
                .to
                .throw(`Relay request Encoded data must be the same as Transaction data`);
        });
    })
});
