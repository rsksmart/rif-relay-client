import BigNumber from 'bignumber.js';
import { expect } from 'chai';
import {
  CacheValue,
  CachedExchangeApi,
  getKeyFromArgs,
} from '../../../src/api/pricer/CachedExchangeApi';
import type { ExchangeApi } from 'src/api/pricer/BaseExchangeApi';
import sinon from 'sinon';

describe('CachedExchangeApi', function () {
  const sourceCurrency = 'source';
  const targetCurrency = 'target';
  const valueFromExchange = '1';
  let fakeExchangeAPI: ExchangeApi;

  beforeEach(function () {
    fakeExchangeAPI = {
      queryExchangeRate: sinon.fake.resolves(new BigNumber(valueFromExchange)),
    };
  });

  describe('if the value is not cached', function () {
    let cachedExchangeApi: CachedExchangeApi;
    let cache: Map<string, CacheValue<BigNumber>>;

    beforeEach(function () {
      cache = new Map();
      cachedExchangeApi = new CachedExchangeApi(fakeExchangeAPI, 100, cache);
    });

    it('should perform a call to the inner exchange', async function () {
      await cachedExchangeApi.queryExchangeRate(sourceCurrency, targetCurrency);

      expect(fakeExchangeAPI.queryExchangeRate).to.have.been.calledWithExactly(
        sourceCurrency,
        targetCurrency
      );
    });

    it('should store the value', async function () {
      await cachedExchangeApi.queryExchangeRate(sourceCurrency, targetCurrency);
      const key = getKeyFromArgs(sourceCurrency, targetCurrency);

      expect(cache.get(key)?.value.toString()).to.be.eq(valueFromExchange);
    });
  });

  it('should perform a call to the inner exchange if the cached value is expired', async function () {
    const previouslyStoredValue = 100;
    const cache: Map<string, CacheValue<BigNumber>> = new Map();
    const key = getKeyFromArgs(sourceCurrency, targetCurrency);
    // 1 second ago
    const expirationTime = Date.now() - 1_000;
    cache.set(key, {
      value: new BigNumber(previouslyStoredValue),
      expirationTime,
    });
    const cachedExchangeApi = new CachedExchangeApi(
      fakeExchangeAPI,
      100,
      cache
    );
    await cachedExchangeApi.queryExchangeRate(sourceCurrency, targetCurrency);

    expect(fakeExchangeAPI.queryExchangeRate).to.have.been.calledWithExactly(
      sourceCurrency,
      targetCurrency
    );
    expect(cache.get(key)?.value.toString()).to.be.eq(valueFromExchange);
  });

  it('should not perform a call to the inner exchange if the cached value is not expired', async function () {
    const cache: Map<string, CacheValue<BigNumber>> = new Map();
    const key = getKeyFromArgs(sourceCurrency, targetCurrency);
    // in 10 seconds
    const expirationTime = Date.now() + 10_000;
    cache.set(key, {
      value: new BigNumber(100),
      expirationTime,
    });
    const cachedExchangeApi = new CachedExchangeApi(
      fakeExchangeAPI,
      100,
      cache
    );
    await cachedExchangeApi.queryExchangeRate(sourceCurrency, targetCurrency);

    expect(fakeExchangeAPI.queryExchangeRate).not.to.have.been.called;
  });
});
