import { JsonRpcProvider } from "@ethersproject/providers";
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import RelayProvider from '../src/RelayProvider';
import RelayClient from 'src/RelayClient';
import { FAKE_ENVELOPING_CONFIG } from './config.fakes';

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
    it('should store Relay Client', function () {
      const stubbedClient =
        sandbox.createStubInstance(RelayClient);

      const relayProvider = new RelayProvider('mock_url', 'mock_network', stubbedClient);

      expect(relayProvider).to.be.instanceOf(RelayProvider);
    });
  });

  describe('methods', function () {
    type RelayProviderExposed = {
      _useEnveloping: (payload: { method: string }) => boolean;
    } & {
      [key in keyof RelayProvider]: RelayProvider[key];
    };

    let relayProvider: RelayProviderExposed;

    beforeEach(function () {
      sandbox.stub(JsonRpcProvider.prototype, 'detectNetwork').resolves({
        name: 'dummy network',
        chainId: 0,
      });

      const stubbedRelayClient = sandbox.createStubInstance(RelayClient);
      relayProvider = new RelayProvider(undefined, undefined, stubbedRelayClient) as unknown as RelayProviderExposed;
    });

    describe('_useEnveloping', function() {

      it('should do stuff', function() {

        const payload = {
          method: 'eth_accounts'
        }

        relayProvider._useEnveloping(payload);
      })
    })
  });
});
