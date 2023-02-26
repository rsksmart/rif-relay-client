import { LogLevel } from '@ethersproject/logger';
import { agent } from 'superagent';
import { expect, use } from 'chai';
import log from 'loglevel';
import { createSandbox } from 'sinon';
import sinonChai from 'sinon-chai';
import HttpWrapper, {
  requestInterceptors,
} from '../../../src/api/common/HttpWrapper';

const sandbox = createSandbox();
use(sinonChai);

const fakeURL = 'http://foo.bar';

describe('HttpWrapper', function () {
  afterEach(function () {
    sandbox.restore();
  });

  describe('constructor', function () {
    it('should create new http client with given params', function () {
      const expectedCreateParams = {
        timeout: 1,
      };
      const httpWrapper = new HttpWrapper(expectedCreateParams);

      expect(httpWrapper).to.be.instanceOf(HttpWrapper);
    });

    it('should create new http client with default params', function () {
      const httpWrapper = new HttpWrapper();

      expect(httpWrapper).to.be.instanceOf(HttpWrapper);
    });

    it('should set logging level', function () {
      const setLogLevelsSpy = sandbox.spy(
        log.getLogger('HttpWrapper'),
        'setLevel'
      );
      const expectedLogLevel = LogLevel.INFO;
      new HttpWrapper({}, expectedLogLevel);

      expect(setLogLevelsSpy).to.be.calledWith(expectedLogLevel);
    });

    it('should set interceptors', function () {
      const superAgentEventSpy = sandbox.spy(agent.prototype, 'on');
      new HttpWrapper();

      expect(superAgentEventSpy).to.be.calledWith(
        'response',
        requestInterceptors.logRequest.onResponse
      );
      expect(superAgentEventSpy).to.be.calledWith(
        'error',
        requestInterceptors.logRequest.onError
      );
    });
  });

  describe('methods', function () {
    describe('sendPromise', function () {
      it('should call SuperAgent.post.send if request data exists', async function () {
        const expectedPostParams = {
          url: fakeURL,
          data: { foo: 'bar' },
        };

        const postResponse = {
          send: () => Promise.resolve(expectedPostParams.data),
        };

        const superAgentSendSpy = sandbox
          .stub(postResponse, 'send')
          .resolves(expectedPostParams.data);
        const superAgentPostSpy = sandbox
          .stub(agent.prototype, 'post')
          .returns({
            send: superAgentSendSpy,
          });

        const httpWrapper = new HttpWrapper({}, log.levels.SILENT);

        await httpWrapper.sendPromise(
          expectedPostParams.url,
          expectedPostParams.data
        );

        expect(superAgentPostSpy).to.be.calledWith(fakeURL);
        expect(superAgentSendSpy).to.be.calledWith(expectedPostParams.data);
      });

      it('should call SuperAgent.get if request data does not exist', async function () {
        const superAgentPostSpy = sandbox
          .stub(agent.prototype, 'get')
          .resolvesThis();
        const expectedPostParams = {
          url: fakeURL,
        };
        const httpWrapper = new HttpWrapper({}, log.levels.SILENT);

        await httpWrapper.sendPromise(expectedPostParams.url);

        expect(superAgentPostSpy).to.be.called;
        expect(superAgentPostSpy).to.be.calledWith(fakeURL);
      });

      it('should return response data', async function () {
        const expectedResponse = { foo: 'bar' };
        sandbox
          .stub(agent.prototype, 'get')
          .resolves({ body: expectedResponse });
        const httpWrapper = new HttpWrapper({}, log.levels.SILENT);
        const result = await httpWrapper.sendPromise(fakeURL);

        expect(result).to.equal(expectedResponse);
      });

      it('should throw error if response contains error', async function () {
        const fakeServer = sandbox.useFakeServer();
        const expectedError = 'foo';
        fakeServer.respondWith(() => ({ data: { error: expectedError } }));

        const httpWrapper = new HttpWrapper({}, log.levels.SILENT);

        await expect(httpWrapper.sendPromise(fakeURL)).to.be.rejectedWith(
          expectedError
        );
      });
    });
  });
});
