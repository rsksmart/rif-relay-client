import { LogLevel } from '@ethersproject/logger';
import axios, { Axios } from 'axios';
import { expect, use } from 'chai';
import log from 'loglevel';
import { createSandbox } from 'sinon';
import sinonChai from 'sinon-chai';
import HttpWrapper from '../../../src/api/common/HttpWrapper';

const sandbox = createSandbox();
use(sinonChai);

const fakeURL = 'http://foo.bar';
describe('HttpWrapper', function () {
  afterEach(function () {
    sandbox.restore();
  });
  describe('constructor', function () {
    it('should create new http client with given params', function () {
      const axiosCreateSpy = sandbox.spy(axios, 'create');
      const expectedCreateParams = {
        timeout: 1,
        headers: { 'Content-Type': 'application/json' },
        foo: 'bar',
      };
      new HttpWrapper(expectedCreateParams);

      expect(axiosCreateSpy).to.be.called;
      expect(axiosCreateSpy).to.be.calledWith(expectedCreateParams);
    });

    it('should create new http client with default params', function () {
      const axiosCreateSpy = sandbox.spy(axios, 'create');
      const expectedCreateParams = {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' },
      };
      new HttpWrapper();

      expect(axiosCreateSpy).to.be.called;
      expect(axiosCreateSpy).to.be.calledWith(expectedCreateParams);
    });

    it('should set logging level', function () {
      const setLogLevelsSpy = sandbox.spy(log, 'setLevel');
      const expectedLogLevel = LogLevel.INFO;
      new HttpWrapper({}, expectedLogLevel);
      
      expect(setLogLevelsSpy).to.be.calledWith(expectedLogLevel);
    } );
  });

  describe('', function () {
    describe('sendPromise', function () {
      it('should call axios.request with given params', async function () {
        const axiosPostSpy = sandbox
          .stub(Axios.prototype, 'request')
          .resolves({ foo: 'bar' });
        const expectedPostParams = {
          url: fakeURL,
          data: { foo: 'bar' },
        };
        const httpWrapper = new HttpWrapper();

        await httpWrapper.sendPromise(
          expectedPostParams.url,
          expectedPostParams.data
        );

        expect(axiosPostSpy).to.be.called;
        expect(axiosPostSpy).to.be.calledWith({
          url: expectedPostParams.url,
          method: sandbox.match.any,
          data: expectedPostParams.data,
        });
      });

      it('should call axios.request with POST method if request data exists', async function () {
        const axiosPostSpy = sandbox
          .stub(Axios.prototype, 'request')
          .resolves({ foo: 'bar' });
        const expectedPostParams = {
          url: fakeURL,
          data: { foo: 'bar' },
        };
        const httpWrapper = new HttpWrapper();

        await httpWrapper.sendPromise(
          expectedPostParams.url,
          expectedPostParams.data
        );

        expect(axiosPostSpy).to.be.called;
        expect(axiosPostSpy).to.be.calledWith({
          url: sandbox.match.any,
          method: 'POST',
          data: sandbox.match.any,
        });
      });

      it('should call axios.request with GET method if request data does not exist', async function () {
        const axiosPostSpy = sandbox
          .stub(Axios.prototype, 'request')
          .resolves({ foo: 'bar' });
        const expectedPostParams = {
          url: fakeURL,
        };
        const httpWrapper = new HttpWrapper();

        await httpWrapper.sendPromise(expectedPostParams.url);

        expect(axiosPostSpy).to.be.called;
        expect(axiosPostSpy).to.be.calledWith({
          url: sandbox.match.any,
          method: 'GET',
          data: sandbox.match.any,
        });
      });

      it('should return response data', async function () {
        const expectedResponse = { foo: 'bar' };
        sandbox
          .stub(Axios.prototype, 'request')
          .resolves({ data: expectedResponse });
        const httpWrapper = new HttpWrapper();
        const result = await httpWrapper.sendPromise(fakeURL);

        expect(result).to.equal(expectedResponse);
      });
    });
  });
});
