import type { EnvelopingTypes } from '@rsksmart/rif-relay-contracts/dist/typechain-types/contracts/RelayHub';
import { expect, use } from 'chai';
import { createSandbox } from 'sinon';
import sinonChai from 'sinon-chai';
import { HttpClient, HttpWrapper } from '../../../src/api/common';

const sandbox = createSandbox();
use(sinonChai);

const fakeURL = 'http://foo.bar';
const GET_ADDRESS_PATH = '/getaddr';
const RELAY_PATH = '/relay';
const POST_ESTIMATE = '/estimate';
const VERIFIER_SUFFIX = '?verifier=';

describe('HttpClient', function () {
  afterEach(function () {
    sandbox.restore();
  });
  
  describe('constructor', function () {
    it('should store http wrapper', function () {
     const expectedHttpWrapper = new HttpWrapper();
      const httpClient = new HttpClient(expectedHttpWrapper);

      expect((httpClient as unknown as {
        _httpWrapper: HttpWrapper
      })._httpWrapper).to.be.equal(expectedHttpWrapper);
    });
  });

  describe('getChainInfo', function () {
    it(`should call httpWrapper.sendPromise with given url + '${GET_ADDRESS_PATH}'`, async function () {
      const expectedSendPromiseUrl = fakeURL + GET_ADDRESS_PATH;
      const httpWrapperSendPromiseSpy = sandbox
        .stub(HttpWrapper.prototype, 'sendPromise').resolves({ foo: 'bar' });
      const httpClient = new HttpClient(new HttpWrapper());
      await httpClient.getChainInfo(fakeURL);

      expect(httpWrapperSendPromiseSpy).to.be.called;
      expect(httpWrapperSendPromiseSpy).to.be.calledWith(
        expectedSendPromiseUrl,
      );
    });

    it(`should call httpWrapper.sendPromise with given url + '${GET_ADDRESS_PATH}' + given verifier`, async function () {
      const verifier = '0x123';
      const expectedSendPromiseUrl = fakeURL + GET_ADDRESS_PATH + VERIFIER_SUFFIX + verifier;
      const httpWrapperSendPromiseSpy = sandbox
        .stub(HttpWrapper.prototype, 'sendPromise').resolves({ foo: 'bar' });
      const httpClient = new HttpClient(new HttpWrapper());
      await httpClient.getChainInfo(fakeURL, verifier);

      expect(httpWrapperSendPromiseSpy).to.be.called;
      expect(httpWrapperSendPromiseSpy).to.be.calledWith(
        expectedSendPromiseUrl,
      );
    });

    it('should return response data', async function () {
      const expectedResponse = { foo: 'bar' };
      sandbox
        .stub(HttpWrapper.prototype, 'sendPromise')
        .resolves(expectedResponse);
      const httpClient = new HttpClient(new HttpWrapper());

      const response = await httpClient.getChainInfo(fakeURL);

      expect(response).to.be.equal(expectedResponse);
    });

    it('should throw error if response contains message field', async function () {
      sandbox
        .stub(HttpWrapper.prototype, 'sendPromise')
        .resolves({ message: 'bar' });
      const httpClient = new HttpClient(new HttpWrapper());

      await expect(httpClient.getChainInfo(fakeURL)).to.be.rejectedWith(
        'Got error response from relay: bar',
      );
    });
  });

  describe('relayTransaction', function () {
    it(`should call httpWrapper.sendPromise with given url + ${RELAY_PATH}`, async function () {
      const request = { foo: 'bar' } as unknown as EnvelopingTypes.DeployRequestStruct;
      const expectedSendPromiseUrl = fakeURL + RELAY_PATH;
      const httpWrapperSendPromiseSpy = sandbox
        .stub(HttpWrapper.prototype, 'sendPromise').resolves({ signedTx: '0x123',
        });
      const httpClient = new HttpClient(new HttpWrapper());
      await httpClient.relayTransaction(fakeURL, request);
      
      expect(httpWrapperSendPromiseSpy).to.be.called;
      expect(httpWrapperSendPromiseSpy).to.be.calledWith(
        expectedSendPromiseUrl);
    });

    it('should call httpWrapper.sendPromise with given request', async function () {
        const request = { foo: 'bar' } as unknown as EnvelopingTypes.DeployRequestStruct;
        const httpWrapperSendPromiseSpy = sandbox.stub(HttpWrapper.prototype, 'sendPromise').resolves({ signedTx: '0x123' });
        const httpClient = new HttpClient(new HttpWrapper());
        await httpClient.relayTransaction(fakeURL, request);

        expect(httpWrapperSendPromiseSpy).to.be.called;
        expect(httpWrapperSendPromiseSpy).to.be.calledWith(
          sandbox.match.any,
          request,
        );
    });

    it('shouold return signedTx', async function () {
        const request = { foo: 'bar' } as unknown as EnvelopingTypes.DeployRequestStruct;
        const expectedSignedTx = '0x123';
        sandbox.stub(HttpWrapper.prototype, 'sendPromise').resolves({ signedTx: expectedSignedTx });
        const httpClient = new HttpClient(new HttpWrapper());
        const result = await httpClient.relayTransaction(fakeURL, request);

        expect(result).to.be.equal(expectedSignedTx);
    });
    
    it('should throw error if response object does not contain signedTx', async function () {
        const request = { foo: 'bar' } as unknown as EnvelopingTypes.DeployRequestStruct;
        const expectedError = 'Got invalid response from relay: signedTx field missing.';
        sandbox.stub(HttpWrapper.prototype, 'sendPromise').resolves({ foo: 'bar' });
        const httpClient = new HttpClient(new HttpWrapper());

        await expect(httpClient.relayTransaction(fakeURL, request)).to.be.rejectedWith(expectedError);
    })
  });

  describe('estimateMaxPossibleGas', function () {
    it('should call httpWrapper.sendPromise with given url + POST_ESTIMATE', async function () {
      const request = { foo: 'bar' } as unknown as EnvelopingTypes.DeployRequestStruct;
      const expectedSendPromiseUrl = fakeURL + POST_ESTIMATE;
      const httpWrapperSendPromiseSpy = sandbox.stub(HttpWrapper.prototype, 'sendPromise').resolves({ gas: '123' });
      const httpClient = new HttpClient(new HttpWrapper());
      await httpClient.estimateMaxPossibleGas(fakeURL, request);

      expect(httpWrapperSendPromiseSpy).to.be.called;
      expect(httpWrapperSendPromiseSpy).to.be.calledWith(
        expectedSendPromiseUrl,
      );
    });

    it('should call httpWrapper.sendPromise with given request', async function () {
      const request = { foo: 'bar' } as unknown as EnvelopingTypes.DeployRequestStruct;
      const httpWrapperSendPromiseSpy = sandbox.stub(HttpWrapper.prototype, 'sendPromise').resolves({ gas: '123' });
      const httpClient = new HttpClient(new HttpWrapper());
      await httpClient.estimateMaxPossibleGas(fakeURL, request);

      expect(httpWrapperSendPromiseSpy).to.be.called;
      expect(httpWrapperSendPromiseSpy).to.be.calledWith(
        sandbox.match.any,
        request,
      );
    });

    it('should return the response', async function () {
      const request = { foo: 'bar' } as unknown as EnvelopingTypes.DeployRequestStruct;
      const expectedGasEstimation = {foo: 'bar'};
      sandbox.stub(HttpWrapper.prototype, 'sendPromise').resolves(expectedGasEstimation);
      const httpClient = new HttpClient(new HttpWrapper());
      const result = await httpClient.estimateMaxPossibleGas(fakeURL, request);

      expect(result).to.be.equal(expectedGasEstimation);
    });
  });
});
