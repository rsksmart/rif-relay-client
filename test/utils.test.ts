import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BigNumber, constants, Transaction, Wallet } from 'ethers';
import type Sinon from 'sinon';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { RelayHub, RelayHub__factory } from '@rsksmart/rif-relay-contracts';
import { HttpClient } from '../src/api/common';
import type { EnvelopingConfig } from '../src/common/config.types';
import type {
  HubInfo,
  RelayInfo,
  RelayManagerData,
} from '../src/common/relayHub.types';
import { selectNextRelay, useEnveloping, validateRelayResponse } from '../src/utils';
import { FAKE_ENVELOPING_CONFIG } from './config.fakes';
import { FAKE_HUB_INFO } from './relayHub.fakes';
import { FAKE_DEPLOY_TRANSACTION_REQUEST, FAKE_RELAY_REQUEST, FAKE_RELAY_TRANSACTION_REQUEST } from './request.fakes';
import * as clientConfiguration from '../src/clientConfiguration';

use(sinonChai);
use(chaiAsPromised);

const createRandomAddress = () => Wallet.createRandom().address;

describe('utils', function () {
  const unavailableRelayHub: HubInfo = {
    ...FAKE_HUB_INFO,
    ready: false,
  };

  const availableRelayHub: HubInfo = {
    ...FAKE_HUB_INFO,
    ready: true,
  };

  const preferredRelays: EnvelopingConfig['preferredRelays'] = [
    {
      manager: '',
      url: 'https://first.relay.co',
      currentlyStaked: true,
      registered: true,
    },
    {
      manager: '',
      url: 'http://second.relay.co',
      currentlyStaked: true,
      registered: true,
    },
    {
      manager: '',
      url: 'http://third.relay.co',
      currentlyStaked: true,
      registered: true,
    },
  ];

  let httpClientStub: Sinon.SinonStubbedInstance<HttpClient>;

  beforeEach(function () {
    sinon.replace(clientConfiguration, 'getEnvelopingConfig', () => {
      return {
        ...FAKE_ENVELOPING_CONFIG,
        preferredRelays,
      }
    });
    httpClientStub = sinon.createStubInstance(HttpClient);
  });

  afterEach(function () {
    sinon.restore();
  });


  describe('selectNextRelay() function', function () {
    it('Should iterate the array of relays and select an available one', async function () {
      httpClientStub.getChainInfo
        .onFirstCall()
        .resolves(unavailableRelayHub)
        .onSecondCall()
        .resolves(availableRelayHub);
      const { url: expectedUrl } = preferredRelays[1] as RelayManagerData;

      const {
        managerData: { url: actualUrl },
      } = (await selectNextRelay(httpClientStub)) as RelayInfo;

      expect(actualUrl).to.equal(expectedUrl);
    });

    it('Should return undefined if not relay is available', async function () {
      httpClientStub.getChainInfo.resolves(unavailableRelayHub);
      const nextRelay = await selectNextRelay(httpClientStub);

      expect(nextRelay).to.be.undefined;
    });

    it('Should keep iterating if a ping call throws an error', async function () {
      const { url: expectedUrl } = preferredRelays[1] as RelayManagerData;
      httpClientStub.getChainInfo
        .onFirstCall()
        .throws(new Error('Some fake error'))
        .onSecondCall()
        .resolves(availableRelayHub);
      const {
        managerData: { url: actualUrl },
      } = (await selectNextRelay(httpClientStub)) as RelayInfo;

      expect(actualUrl).to.equal(expectedUrl);
    });
  });


  describe('validateRelayResponse', function () {
    let relayWorkerAddress: string;
    let relayHubAddress: string;

    beforeEach(function () {
      relayWorkerAddress = createRandomAddress();
      relayHubAddress = FAKE_ENVELOPING_CONFIG.relayHubAddress;

      const encodeFunctionDataStub = sinon.stub();

      encodeFunctionDataStub.withArgs('relayCall', sinon.match.any).returns('Dummy Relay Data')
      encodeFunctionDataStub.withArgs('deployCall', sinon.match.any).returns('Dummy Deploy Data');
      const relayHubStub = {
        interface: {
          encodeFunctionData: encodeFunctionDataStub
        }
      } as unknown as RelayHub;
      sinon.stub(RelayHub__factory, 'connect').returns(relayHubStub);
    });

    afterEach(function () {
      sinon.restore();
    });

    it('Should perform checks on relay transaction and not throw errors', function () {
      const transaction: Transaction = {
        nonce: BigNumber.from(
          FAKE_RELAY_TRANSACTION_REQUEST.metadata.relayMaxNonce
        ).toNumber(),
        chainId: 33,
        data: 'Dummy Relay Data',
        gasLimit: constants.Zero,
        value: constants.Zero,
        to: relayHubAddress,
        from: relayWorkerAddress,
      };

      expect(() =>
        validateRelayResponse(
          FAKE_RELAY_TRANSACTION_REQUEST,
          transaction,
          relayWorkerAddress
        )
      ).to.not.throw();
    });

    it('Should throw error if transaction has no recipient address', function () {
      const transaction: Transaction = {
        nonce: 7,
        chainId: 33,
        data: 'Dummy Deploy Data',
        gasLimit: constants.Zero,
        value: constants.Zero,
        to: undefined,
        from: relayWorkerAddress,
      };

      expect(() =>
        validateRelayResponse(
          FAKE_DEPLOY_TRANSACTION_REQUEST,
          transaction,
          relayWorkerAddress
        )
      ).to.throw(`Transaction has no recipient address`);
    });

    it('Should throw error if transaction has no sender address', function () {
      const transaction: Transaction = {
        nonce: 7,
        chainId: 33,
        data: 'Dummy Deploy Data',
        gasLimit: constants.Zero,
        value: constants.Zero,
        to: relayHubAddress,
        from: undefined,
      };

      expect(() =>
        validateRelayResponse(
          FAKE_DEPLOY_TRANSACTION_REQUEST,
          transaction,
          relayWorkerAddress
        )
      ).to.throw(`Transaction has no signer`);
    });

    it('Should throw error if nonce is greater than relayMaxNonce', function () {
      const transaction: Transaction = {
        nonce: 7,
        chainId: 33,
        data: 'Dummy Deploy Data',
        gasLimit: constants.Zero,
        value: constants.Zero,
        to: relayHubAddress,
        from: relayWorkerAddress,
      };

      const { metadata: { relayMaxNonce } } = FAKE_DEPLOY_TRANSACTION_REQUEST;

      expect(() =>
        validateRelayResponse(
          FAKE_DEPLOY_TRANSACTION_REQUEST,
          transaction,
          relayWorkerAddress
        )
      ).to.throw(
        `Relay used a tx nonce higher than requested. Requested ${relayMaxNonce.toString()} got ${transaction.nonce}`
      );
    });

    it('Should throw error if Transaction recipient is not the RelayHubAddress', function () {
      const transaction: Transaction = {
        nonce: 2,
        chainId: 33,
        data: 'Dummy Deploy Data',
        gasLimit: constants.Zero,
        value: constants.Zero,
        to: 'Dummy Address',
        from: relayWorkerAddress,
      };

      expect(() =>
        validateRelayResponse(
          FAKE_DEPLOY_TRANSACTION_REQUEST,
          transaction,
          relayWorkerAddress
        )
      ).to.throw(`Transaction recipient must be the RelayHubAddress`);
    });

    it('Should throw error if Relay request Encoded data is not the same as Transaction data', function () {
      const transaction: Transaction = {
        nonce: 2,
        chainId: 33,
        data: 'Dummy Different Data',
        gasLimit: constants.Zero,
        value: constants.Zero,
        to: relayHubAddress,
        from: relayWorkerAddress,
      };

      expect(() =>
        validateRelayResponse(
          FAKE_DEPLOY_TRANSACTION_REQUEST,
          transaction,
          relayWorkerAddress
        )
      ).to.throw(
        `Relay request Encoded data must be the same as Transaction data`
      );
    });

    it('Should throw error if Relay Worker is not the same as Transaction sender', function () {
      const transaction: Transaction = {
        nonce: 2,
        chainId: 33,
        data: 'Dummy Deploy Data',
        gasLimit: constants.Zero,
        value: constants.Zero,
        to: relayHubAddress,
        from: 'Dummy Address',
      };

      expect(() =>
        validateRelayResponse(
          FAKE_DEPLOY_TRANSACTION_REQUEST,
          transaction,
          relayWorkerAddress
        )
      ).to.throw(
        `Transaction sender address must be the same as configured relayWorker address`
      );
    });
  });
  
  describe('useEnveloping', function() {

    it('Should return true if method is eth_accounts', function() {
      expect(useEnveloping('eth_accounts', [])).to.be.true;
    })

    it('Should return false if params is empty', function() {
      expect(useEnveloping('eth_other', [])).to.be.false;
    })

    it('Should return true if params contains envelopingTx, requestConfig and requestConfig.useEnveloping is true', function() {
      const result = useEnveloping('eth_sendTransaction', [{
        envelopingTx: FAKE_RELAY_REQUEST,
        requestConfig: { 
          useEnveloping: true 
        }
      }]);

      expect(result).to.be.true;
    })
  })
});
