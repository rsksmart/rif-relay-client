import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { HttpClient, HttpWrapper } from '../../src/api/common';
import type { RelayManagerData } from '../../src/common/config.types';
import type { HubInfo } from '../../src/common/relayHub.types';
import { selectNextRelay } from '../../src/utils';

use(sinonChai);
use(chaiAsPromised);

describe('RelaySelectionManager', function () {
  const badPingResponse: HubInfo = {
    relayWorkerAddress: '0x',
    relayManagerAddress: '0x',
    relayHubAddress: '0x',
    feesReceiver: '0x',
    minGasPrice: '0',
    ready: false,
    version: '0.1',
  };

  const goodPingResponse: HubInfo = {
    relayWorkerAddress: '0x',
    relayManagerAddress: '0x',
    relayHubAddress: '0x',
    feesReceiver: '0x',
    minGasPrice: '0',
    ready: true,
    version: '0.1',
  };

  const preferredRelays: Array<RelayManagerData> = [
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

  let httpClient: HttpClient;

  beforeEach(function () {
    httpClient = new HttpClient(new HttpWrapper());
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('selectNextRelay() function', function () {
    it.skip('Should iterate the array of relays and select an available one', async function () {
      // FIXME: fix test
      const stubHttpClient = sinon.stub(httpClient);

      stubHttpClient.getChainInfo
        .onFirstCall()
        .resolves(badPingResponse)
        .onSecondCall()
        .resolves(goodPingResponse);

      sinon.stub(config, 'get').returns(preferredRelays);

      const nextRelay = await selectNextRelay(httpClient);

      expect(nextRelay?.relayInfo?.url).to.equal(preferredRelays[1]?.url);
    });

    it.skip('Should use the default httpClient if not provided as parameter', async function () {
      // FIXME: fix test
      const stubHttpClient = sinon.stub(httpClient);

      stubHttpClient.getChainInfo
        .onFirstCall()
        .resolves(badPingResponse)
        .onSecondCall()
        .resolves(badPingResponse)
        .onThirdCall()
        .resolves(goodPingResponse);

      sinon.stub(config, 'get').returns(preferredRelays);

      const nextRelay = await selectNextRelay();

      expect(nextRelay?.relayInfo?.url).to.equal(preferredRelays[2]?.url);
    });

    it('Should return undefined if not relay is available', async function () {
      const stubHttpClient = sinon.stub(httpClient);
      stubHttpClient.getChainInfo.resolves(badPingResponse);

      sinon.stub(config, 'get').returns(preferredRelays);

      const nextRelay = await selectNextRelay(httpClient);

      expect(nextRelay).to.be.undefined;
    });

    it.skip('Should keep iterating if a ping call throws an error', async function () {
      // FIXME: fix test
      const stubHttpClient = sinon.stub(httpClient);
      stubHttpClient.getChainInfo
        .onFirstCall()
        .throws(new Error('Some fake error'))
        .onSecondCall()
        .resolves(goodPingResponse);

      sinon.stub(config, 'get').returns(preferredRelays);

      const nextRelay = await selectNextRelay(httpClient);

      expect(nextRelay?.relayInfo?.url).to.equal(preferredRelays[1]?.url);
    });

    it.skip('Should fail if cannnot find a config', async function () {
      // FIXME: fix test
      const ERROR_MESSAGE = 'Some error getting the config';
      sinon.stub(config, 'get').throws(new Error(ERROR_MESSAGE));

      const stubHttpClient = sinon.stub(httpClient);
      stubHttpClient.getChainInfo
        .onFirstCall()
        .resolves(badPingResponse)
        .onSecondCall()
        .resolves(goodPingResponse);

      await expect(selectNextRelay(httpClient)).to.be.rejectedWith(
        ERROR_MESSAGE
      );
    });
  });
});
