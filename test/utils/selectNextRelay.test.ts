import * as sinon from 'sinon';
import { expect , use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import { type RelayManagerData, selectNextRelay } from '../../src/utils';
import { HttpWrapper, HttpClient } from '../../src/api/common';
import config from 'config';
import * as defaultClient from '../../src/api/common/HttpClient';
import type {
  HubInfo
} from '../../src/common/relay.types';

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
    it('Should iterate the array of relays and select an available one', async function () {
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

    it('Should use the default httpClient if not provided as parameter', async function () {
      const stubDefaultHttpClient = sinon.stub(defaultClient, 'getDefaultHttpClient');
      stubDefaultHttpClient.returns(httpClient);

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

    it('Should keep iterating if a ping call throws an error', async function () {
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

    it('Should fail if cannnot find a config', async function(){
        const ERROR_MESSAGE = 'Some error getting the config';
        sinon.stub(config, 'get').throws(new Error(ERROR_MESSAGE));

        const stubHttpClient = sinon.stub(httpClient);
        stubHttpClient.getChainInfo
            .onFirstCall().resolves(badPingResponse)
            .onSecondCall().resolves(goodPingResponse);
        
        await expect(selectNextRelay(httpClient)).to.be.rejectedWith(ERROR_MESSAGE);
    });
  });
});
