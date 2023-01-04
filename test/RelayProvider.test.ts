import { JsonRpcProvider, TransactionReceipt, Network } from "@ethersproject/providers";
import { Interface, LogDescription } from "@ethersproject/abi";
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import Sinon, { SinonStub } from 'sinon';
import sinonChai from 'sinon-chai';
import RelayProvider, { RelayingResult } from '../src/RelayProvider';
import RelayClient, { RequestConfig } from '../src/RelayClient';
import { FAKE_ENVELOPING_CONFIG } from './config.fakes';
import type { UserDefinedEnvelopingRequest } from "src/common/relayRequest.types";
import { BigNumber, Transaction } from "ethers";
import AccountManager from "../src/AccountManager";
import { FAKE_RELAY_REQUEST } from "./request.fakes";
import * as utils from '../src/utils';

use(sinonChai);
use(chaiAsPromised);
const sandbox = Sinon.createSandbox();

describe('RelayProvider', function () {
  const originalConfig = { ...config };
  before(function () {
    config.util.extendDeep(config, {
      EnvelopingConfig: FAKE_ENVELOPING_CONFIG,
    });
  });

  after(function () {
    config.util.extendDeep(config, originalConfig);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('constructor', function () {
    it('should store JsonRpcProvider and RelayClient', function () {
      const stubbedProvider = sandbox.createStubInstance(JsonRpcProvider);
      const stubbedRelayClient = sandbox.createStubInstance(RelayClient);

      const relayProvider = new RelayProvider(stubbedRelayClient, stubbedProvider) as unknown as { jsonRpcProvider: JsonRpcProvider, relayClient: RelayClient };

      expect(relayProvider).to.be.instanceOf(RelayProvider);
      expect(
        relayProvider.jsonRpcProvider,
      ).to.equal(stubbedProvider);
      expect(
        relayProvider.relayClient,
      ).to.equal(stubbedRelayClient);
    });

    it('should create JsonRpcProvider and store RelayClient', function () {
      const stubbedRelayClient = sandbox.createStubInstance(RelayClient);

      const network: Network = {
        chainId: 33,
        name: 'rskj'
      }

      const providerParams = {
        url: 'localhost',
        network 
      }

      const relayProvider = new RelayProvider(stubbedRelayClient, providerParams) as unknown as { jsonRpcProvider: JsonRpcProvider, relayClient: RelayClient };

      expect(relayProvider).to.be.instanceOf(RelayProvider);
      expect(
        relayProvider.jsonRpcProvider,
      ).to.be.instanceOf(JsonRpcProvider);
      expect(
        relayProvider.relayClient,
      ).to.equal(stubbedRelayClient);
    });
  });

  describe('methods', function () {
    type RelayProviderExposed = {
      _getRelayStatus: (respResult: TransactionReceipt) => {
        relayRevertedOnRecipient: boolean;
        transactionRelayed: boolean;
        reason?: string;
      },
      executeRelayTransaction(
        envelopingRequest: UserDefinedEnvelopingRequest,
        requestConfig: RequestConfig
      ): Promise<RelayingResult>,
      _ethSendTransaction(
        envelopingRequest: UserDefinedEnvelopingRequest,
        requestConfig: RequestConfig
      ): Promise<RelayingResult>,
      relayClient: RelayClient,
      jsonRpcProvider: JsonRpcProvider
    } & {
      [key in keyof RelayProvider]: RelayProvider[key];
    };

    let relayProvider: RelayProviderExposed;

    beforeEach(function () {
      const stubbedRelayClient = sandbox.createStubInstance(RelayClient);
      const stubbedProvider = sandbox.createStubInstance(JsonRpcProvider);
      relayProvider = new RelayProvider(stubbedRelayClient, stubbedProvider) as unknown as RelayProviderExposed;
    });

    describe('_getRelayStatus', function() {

      const trxReceipt = {
        logs: [
          { 
            blockNumber: 5196629,
            blockHash: '0x19b083ee0752347f0bba9cd1cf19c827fd108c0f5d4973e33719d97a60cf14ca',
            transactionIndex: 1,
            removed: false,
            address: '0xF92298d72afE68300EA065c0EdaDbb1A29804faa',
            data: '0x00000000000000000000000000000000000000000000021e19e0c9bab2400000',
            topics: 
            [ '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
              '0x0000000000000000000000000000000000000000000000000000000000000000',
              '0x000000000000000000000000f58e01ac4134468f9ad846034fb9247c6c131d8c' ],
            transactionHash: '0xdad8bc380240548aafecba06bf6cee898513da850bb37859cfea5f93d8dd25da',
            logIndex: 0 
          }
        ],
      }; 

      it('Should handle transaction with no logs', function() {
        const trxReceipt = {} as TransactionReceipt
        const relayStatus = relayProvider._getRelayStatus(trxReceipt);

        expect(relayStatus.transactionRelayed).to.be.false;
        expect(relayStatus.relayRevertedOnRecipient).to.be.false;
        expect(relayStatus.reason).to.eq('Tx logs not found');
      })

      it('Should handle transaction with logs array of size 0', function() {
        const trxReceipt = ({
          logs: [],
        });
        const relayStatus = relayProvider._getRelayStatus(trxReceipt as unknown as TransactionReceipt);

        expect(relayStatus.transactionRelayed).to.be.false;
        expect(relayStatus.relayRevertedOnRecipient).to.be.false;
        expect(relayStatus.reason).to.eq('Tx logs not found');
      })

      it('Should handle TransactionRelayedButRevertedByRecipient event', function() {
        
        const revertReason = 'Transaction reverted because of some reason';

        const dummyLogDescription = {
          name: 'TransactionRelayedButRevertedByRecipient',
          args: {
            reason: revertReason
          }
        }

        sandbox.stub(Interface.prototype, 'parseLog').returns(
          dummyLogDescription as unknown as LogDescription);

        const relayStatus = relayProvider._getRelayStatus(trxReceipt as unknown as TransactionReceipt);

        expect(relayStatus.transactionRelayed).to.be.false;
        expect(relayStatus.relayRevertedOnRecipient).to.be.true;
        expect(relayStatus.reason).to.eq(revertReason);
      })

      it('Should handle TransactionRelayed event', function() {
        
        const dummyLogDescription = {
          name: 'TransactionRelayed',
        }

        sandbox.stub(Interface.prototype, 'parseLog').returns(
          dummyLogDescription as unknown as LogDescription);

        const relayStatus = relayProvider._getRelayStatus(trxReceipt as unknown as TransactionReceipt);

        expect(relayStatus.transactionRelayed).to.be.true;
        expect(relayStatus.relayRevertedOnRecipient).to.be.false;
        expect(relayStatus.reason).to.be.undefined;
      })

      it('Should handle all other events', function() {
        
        const dummyLogDescription = {
          name: 'otherEvent',
        }

        sandbox.stub(Interface.prototype, 'parseLog').returns(
          dummyLogDescription as unknown as LogDescription);

        const relayStatus = relayProvider._getRelayStatus(trxReceipt as unknown as TransactionReceipt);

        expect(relayStatus.transactionRelayed).to.be.false;
        expect(relayStatus.relayRevertedOnRecipient).to.be.false;
        expect(relayStatus.reason).to.equal('Neither TransactionRelayed, Deployed, nor TransactionRelayedButRevertedByRecipient events found. This might be a non-enveloping transaction.');
      })
      
    })

    describe('executeRelayTransaction', function() {

      let hashlessTrx: Transaction;
      let relayTrxStub: SinonStub;

      beforeEach(function(){
        sandbox.restore();
        hashlessTrx = {
          chainId: 31,
          data: 'string data',
          nonce: 1,
          gasLimit: BigNumber.from(0),
          value: BigNumber.from(0)
        };
        relayTrxStub = sandbox.stub(relayProvider.relayClient, 'relayTransaction').resolves(hashlessTrx);
      })

      it('Should throw error if relayed transaction has no hash', async function() {

        const envelopingReq = {} as UserDefinedEnvelopingRequest;
        const reqConfig = {} as RequestConfig;

        await expect(relayProvider.executeRelayTransaction(envelopingReq, reqConfig)).to.be.rejectedWith('Transaction has no hash!');
      })

      it('Should wait for receipt if ignoreTransactionreceipt flag is false', async function() {

        const trxWithHash = {
          ...hashlessTrx, 
            hash: '0xdad8bc380240548aafecba06bf6cee898513da850bb37859cfea5f93d8dd25da'
        }

        relayTrxStub.resolves(trxWithHash);

        sandbox.stub(JsonRpcProvider.prototype, 'waitForTransaction')
          .resolves({ 
            transactionHash: '0xdad8bc380240548aafecba06bf6cee898513da850bb37859cfea5f93d8dd25da'
           } as TransactionReceipt);

        const envelopingReq = {} as UserDefinedEnvelopingRequest;
        const reqConfig = {
          ignoreTransactionReceipt: false
        } as RequestConfig;

        const relayingResult = await relayProvider.executeRelayTransaction(envelopingReq, reqConfig)

        expect(relayingResult.transaction).to.equal(trxWithHash);
        expect(relayingResult.receipt).not.to.be.undefined;
      })

      it('Should ignore receipt if ignoreTransactionreceipt flag is true', async function() {

        const trxWithHash = {
          ...hashlessTrx, 
            hash: '0xdad8bc380240548aafecba06bf6cee898513da850bb37859cfea5f93d8dd25da'
        }

        relayTrxStub.resolves(trxWithHash);

        const envelopingReq = {} as UserDefinedEnvelopingRequest;
        const reqConfig = {
          ignoreTransactionReceipt: true
        } as RequestConfig;

        const relayingResult = await relayProvider.executeRelayTransaction(envelopingReq, reqConfig)

        expect(relayingResult.transaction).to.equal(trxWithHash);
        expect(relayingResult.receipt).to.be.undefined;
      })
    });

    describe('_ethSendTransaction', function() {

      let receiptlessResult: RelayingResult;

      beforeEach(function(){
        receiptlessResult = {
          transaction: {
            chainId: 31,
            data: 'string data',
            nonce: 1,
            gasLimit: BigNumber.from(0),
            value: BigNumber.from(0)
          },
        }
      })

      it('should return the result of a relay transaction with no receipt', async function() {
        sandbox.stub(relayProvider, 'executeRelayTransaction').resolves(receiptlessResult)

        const reqConfig = {
          onlyPreferredRelays: true,
          forceGasLimit: '5000'
        };

        const relayingResult = await relayProvider._ethSendTransaction(FAKE_RELAY_REQUEST, reqConfig);

        expect(relayingResult).to.equal(receiptlessResult);
      })

      it('should throw error if the result includes a receipt and the transaction was reverted', async function() {

        const receipt = {
          transactionHash: '0xdad8bc380240548aafecba06bf6cee898513da850bb37859cfea5f93d8dd25da'
        } as TransactionReceipt

        sandbox.stub(relayProvider, 'executeRelayTransaction').resolves(
        { 
            ...receiptlessResult, 
            receipt
        });

        const relayStatus = { 
          relayRevertedOnRecipient: true, 
          reason: 'some reason', 
          transactionRelayed: false 
        };

        sandbox.stub(relayProvider, '_getRelayStatus')
          .returns(relayStatus)

          const reqConfig = {
            onlyPreferredRelays: true,
            forceGasLimit: '5000'
          };

        await expect(relayProvider._ethSendTransaction(FAKE_RELAY_REQUEST, reqConfig))
          .to.be
          .rejectedWith(`Transaction Relayed but reverted on recipient - TxHash: ${receipt.transactionHash} , Reason: ${relayStatus.reason ?? 'unknown'}`);
      })

      it('should return a relay result including the transaction and receipt', async function() {

        const receipt = {
          transactionHash: '0xdad8bc380240548aafecba06bf6cee898513da850bb37859cfea5f93d8dd25da'
        } as TransactionReceipt

        const expectedRelayResult = { 
          ...receiptlessResult, 
          receipt
      }

        sandbox.stub(relayProvider, 'executeRelayTransaction').resolves(
          expectedRelayResult);

        const relayStatus = { 
          relayRevertedOnRecipient: false, 
          transactionRelayed: true 
        };

        sandbox.stub(relayProvider, '_getRelayStatus')
          .returns(relayStatus)

          const reqConfig = {
            onlyPreferredRelays: true,
            forceGasLimit: '5000'
          };

        const relayResult = await relayProvider._ethSendTransaction(FAKE_RELAY_REQUEST, reqConfig);

        expect(relayResult).to.equal(expectedRelayResult);
      })
    });

    describe('listAccounts', function () {
      it('should return a response if accountsList param is not an array', async function () {

        sandbox.stub(JsonRpcProvider.prototype, 'listAccounts')
          .resolves(undefined);

        const accountsList = await relayProvider.listAccounts();

        expect(accountsList).to.be.equal(undefined);
      })

      it('should return a list of accounts', async function () {

        sandbox.stub(JsonRpcProvider.prototype, 'listAccounts')
          .resolves([ '0xF92298d72afE68300EA065c0EdaDbb1A29804faa' ]);

        sandbox.stub(AccountManager.prototype, 'getAccounts')
          .resolves([ '0xF92298d72afE68300EA065c0EdaDbb1A29804fab' ]);

        const accountsList = await relayProvider.listAccounts();

        expect(accountsList).to.be.equal(undefined);
      })
    })
    
    describe('send', function () {

      let relayingResult: RelayingResult;
      let useEnvelopingStub: SinonStub;

      beforeEach(function(){

        const receipt = {
          transactionHash: '0xdad8bc380240548aafecba06bf6cee898513da850bb37859cfea5f93d8dd25da',
        } as TransactionReceipt;

        relayingResult = {
          transaction: {
            chainId: 31,
            data: 'string data',
            nonce: 1,
            gasLimit: BigNumber.from(0),
            value: BigNumber.from(0)
          },
          receipt,
        };

        useEnvelopingStub = sandbox.stub(utils, 'useEnveloping')
          .returns(true);
      })

      it('should throw error if method is eth_sendTransaction and params correspond to a rif relay transaction but there is no recipient address', function () {

        const params = [{
          requestConfig: {
            useEnveloping: true
          }, 
          envelopingTx: {
            request: {}
          }
        }];

        expect(() => { return relayProvider.send('eth_sendTransaction', params )}).to.throw('Relay Provider cannot relay contract deployment transactions. Add {from: accountWithRBTC, useEnveloping: false}.');
      })

      it('should send transaction using relay provider if method is eth_sendTransaction and params correspond to a rif relay transaction', async function () {

        const ethSendTrxStub = sandbox.stub(relayProvider, '_ethSendTransaction')
          .resolves(relayingResult);

        const requestConfig = {
          useEnveloping: true
        };

        const envelopingTx = FAKE_RELAY_REQUEST;

        const params = [{
          requestConfig,
          envelopingTx
        }];

        await relayProvider.send('eth_sendTransaction', params);

        expect(ethSendTrxStub).to.be.calledWith(envelopingTx, requestConfig);
      })

      it('should send transaction using relay provider if method is eth_accounts and params correspond to a rif relay transaction', async function () {

        const ethListAccountsStub = sandbox.stub(relayProvider, 'listAccounts')
          .resolves(['0xF92298d72afE68300EA065c0EdaDbb1A29804faa']);

        const requestConfig = {
          useEnveloping: true
        };

        const envelopingTx = {};

        const params = [{
          requestConfig,
          envelopingTx
        }];

        await relayProvider.send('eth_accounts', params);

        expect(ethListAccountsStub).to.be.calledWith();
      })

      it('should use JsonRpcProvider send method if not a relay transaction', async function () {
        useEnvelopingStub.returns(false);

        const params = [{}];

        const method = 'eth_sendTransaction';

        await relayProvider.send(method, params);

        expect(relayProvider.jsonRpcProvider.send).to.be.calledWith(method, params)

      })
    })
  });
});
