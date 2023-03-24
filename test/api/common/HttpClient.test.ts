import { expect, use } from 'chai';
import { createSandbox } from 'sinon';
import sinonChai from 'sinon-chai';
import type { EnvelopingTxRequest } from '../../../src/common/relayTransaction.types';
import { HttpClient, HttpWrapper } from '../../../src/api/common';
import { buildUrl } from '../../../src/api/common/HttpClient';

const sandbox = createSandbox();
use(sinonChai);

const fakeURL = 'http://foo.bar';
const CHAIN_INFO_PATH = '/chain-info';
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

      expect(
        (
          httpClient as unknown as {
            _httpWrapper: HttpWrapper;
          }
        )._httpWrapper
      ).to.be.equal(expectedHttpWrapper);
    });
  });

  describe('methods', function () {
    type HttpClientExposed = {
      _stringifyEnvelopingTx: (
        envelopingTx: EnvelopingTxRequest
      ) => EnvelopingTxRequest;
    } & {
      [key in keyof HttpClient]: HttpClient[key];
    };

    describe('getChainInfo', function () {
      let httpClient: HttpClientExposed;

      beforeEach(function () {
        httpClient = new HttpClient(
          new HttpWrapper()
        ) as unknown as HttpClientExposed;
      });

      it(`should call httpWrapper.sendPromise with given url + '${CHAIN_INFO_PATH}'`, async function () {
        const expectedSendPromiseUrl = fakeURL + CHAIN_INFO_PATH;
        const httpWrapperSendPromiseSpy = sandbox
          .stub(HttpWrapper.prototype, 'sendPromise')
          .resolves({ foo: 'bar' });
        await httpClient.getChainInfo(fakeURL);

        expect(httpWrapperSendPromiseSpy).to.be.called;
        expect(httpWrapperSendPromiseSpy).to.be.calledWith(
          expectedSendPromiseUrl
        );
      });

      it(`should call httpWrapper.sendPromise with given url + '${CHAIN_INFO_PATH}' + given verifier`, async function () {
        const verifier = '0x123';
        const expectedSendPromiseUrl =
          fakeURL + CHAIN_INFO_PATH + VERIFIER_SUFFIX + verifier;
        const httpWrapperSendPromiseSpy = sandbox
          .stub(HttpWrapper.prototype, 'sendPromise')
          .resolves({ foo: 'bar' });
        await httpClient.getChainInfo(fakeURL, verifier);

        expect(httpWrapperSendPromiseSpy).to.be.called;
        expect(httpWrapperSendPromiseSpy).to.be.calledWith(
          expectedSendPromiseUrl
        );
      });

      it('should return response data', async function () {
        const expectedResponse = { foo: 'bar' };
        sandbox
          .stub(HttpWrapper.prototype, 'sendPromise')
          .resolves(expectedResponse);
        const response = await httpClient.getChainInfo(fakeURL);

        expect(response).to.be.equal(expectedResponse);
      });

      it('should throw error if response contains error field', async function () {
        sandbox
          .stub(HttpWrapper.prototype, 'sendPromise')
          .resolves({ error: 'bar' });

        await expect(httpClient.getChainInfo(fakeURL)).to.be.rejectedWith(
          'Got error response from relay: bar'
        );
      });
    });

    describe('relayTransaction', function () {
      let httpClient: HttpClientExposed;
      let request: EnvelopingTxRequest;

      beforeEach(function () {
        httpClient = new HttpClient(
          new HttpWrapper()
        ) as unknown as HttpClientExposed;
        request = { foo: 'bar' } as unknown as EnvelopingTxRequest;
        httpClient._stringifyEnvelopingTx = sandbox.stub(() => request);
      });

      it(`should call httpWrapper.sendPromise with given url + ${RELAY_PATH}`, async function () {
        const expectedSendPromiseUrl = fakeURL + RELAY_PATH;
        const httpWrapperSendPromiseSpy = sandbox
          .stub(HttpWrapper.prototype, 'sendPromise')
          .resolves({ signedTx: '0x123' });
        await httpClient.relayTransaction(fakeURL, request);

        expect(httpWrapperSendPromiseSpy).to.be.called;
        expect(httpWrapperSendPromiseSpy).to.be.calledWith(
          expectedSendPromiseUrl
        );
      });

      it('should call httpWrapper.sendPromise with given request', async function () {
        const httpWrapperSendPromiseSpy = sandbox
          .stub(HttpWrapper.prototype, 'sendPromise')
          .resolves({ signedTx: '0x123' });
        await httpClient.relayTransaction(fakeURL, request);

        expect(httpWrapperSendPromiseSpy).to.be.called;
        expect(httpWrapperSendPromiseSpy).to.be.calledWith(
          sandbox.match.any,
          request
        );
      });

      it('should return signedTx', async function () {
        const expectedSignedTx = '0x123';
        sandbox
          .stub(HttpWrapper.prototype, 'sendPromise')
          .resolves({ signedTx: expectedSignedTx });
        const result = await httpClient.relayTransaction(fakeURL, request);

        expect(result).to.be.equal(expectedSignedTx);
      });

      it('should throw error if response object does not contain signedTx', async function () {
        const expectedError =
          'Got invalid response from relay: signedTx field missing.';
        sandbox
          .stub(HttpWrapper.prototype, 'sendPromise')
          .resolves({ foo: 'bar' });

        await expect(
          httpClient.relayTransaction(fakeURL, request)
        ).to.be.rejectedWith(expectedError);
      });

      it('should throw error if response object contains property `error`', async function () {
        const serverError = 'error message from server';

        const expectedError = `Got error response from relay: ${serverError}`;
        sandbox
          .stub(HttpWrapper.prototype, 'sendPromise')
          .resolves({ error: serverError });

        await expect(
          httpClient.relayTransaction(fakeURL, request)
        ).to.be.rejectedWith(expectedError);
      });
    });

    describe('estimateMaxPossibleGas', function () {
      let httpClient: HttpClientExposed;
      let request: EnvelopingTxRequest;

      beforeEach(function () {
        httpClient = new HttpClient(
          new HttpWrapper()
        ) as unknown as HttpClientExposed;
        request = { foo: 'bar' } as unknown as EnvelopingTxRequest;
        httpClient._stringifyEnvelopingTx = sandbox.stub(() => request);
      });

      it('should call httpWrapper.sendPromise with given url + POST_ESTIMATE', async function () {
        const expectedSendPromiseUrl = fakeURL + POST_ESTIMATE;
        const httpWrapperSendPromiseSpy = sandbox
          .stub(HttpWrapper.prototype, 'sendPromise')
          .resolves({ gas: '123' });
        await httpClient.estimateMaxPossibleGas(fakeURL, request);

        expect(httpWrapperSendPromiseSpy).to.be.called;
        expect(httpWrapperSendPromiseSpy).to.be.calledWith(
          expectedSendPromiseUrl
        );
      });

      it('should call httpWrapper.sendPromise with given request', async function () {
        const httpWrapperSendPromiseSpy = sandbox
          .stub(HttpWrapper.prototype, 'sendPromise')
          .resolves({ gas: '123' });
        await httpClient.estimateMaxPossibleGas(fakeURL, request);

        expect(httpWrapperSendPromiseSpy).to.be.called;
        expect(httpWrapperSendPromiseSpy).to.be.calledWith(
          sandbox.match.any,
          request
        );
      });

      it('should return the response', async function () {
        const expectedGasEstimation = { foo: 'bar' };
        sandbox
          .stub(HttpWrapper.prototype, 'sendPromise')
          .resolves(expectedGasEstimation);
        const result = await httpClient.estimateMaxPossibleGas(
          fakeURL,
          request
        );

        expect(result).to.be.equal(expectedGasEstimation);
      });
    });
  });

  describe('buildUrl', function () {
    it('should build the correct URL when the base URL does not have the relative path', function () {
      const base = 'http://www.relay.com';
      const path = '/path';
      const expected = 'http://www.relay.com/path';

      const url = buildUrl(base, path);

      expect(url).to.be.equal(expected);
    });

    it('should build the correct URL when the base URL has the relative path', function () {
      const base = 'http://www.relay.com/path/to/something';
      const path = '/path';
      const expected = 'http://www.relay.com/path/to/something/path';

      const url = buildUrl(base, path);

      expect(url).to.be.equal(expected);
    });

    it("should not include the '/' char twice when joining the base URL and the relative path", function () {
      const base = 'http://www.relay.com/path/to/something/';
      const path = '/path';
      const expected = 'http://www.relay.com/path/to/something/path';

      const url = buildUrl(base, path);

      expect(url).to.be.equal(expected);
    });
  });

  describe('properties', function () {
    it('should expose the `httpWrapper` property', function () {
      const httpClient = new HttpClient();

      expect(httpClient.httpWrapper).not.to.be.undefined;
    });
  });
});
