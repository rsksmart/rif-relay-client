import BigNumber from 'bignumber.js';
import { expect } from 'chai';
import {
  RateWithExpiration,
  ExchangeApiCache,
  getKeyFromArgs,
} from '../../../src/api/pricer/ExchangeApiCache';
import type { ExchangeApi } from 'src/api/pricer/BaseExchangeApi';
import sinon from 'sinon';

describe('ExchangeApiCache', function () {
  const sourceCurrency = 'source';
  const targetCurrency = 'target';
  const valueFromExchange = '1';
  let fakeExchangeAPI: ExchangeApi;

  beforeEach(function () {
    fakeExchangeAPI = {
      queryExchangeRate: sinon.fake.resolves(new BigNumber(valueFromExchange)),
    };
  });

  it('should perform a call to the inner exchange if the value is not cached', async function () {
    const cache = new Map<string, RateWithExpiration>();
    const cachedExchangeApi = new ExchangeApiCache(fakeExchangeAPI, 100, cache);
    const rate = await cachedExchangeApi.queryExchangeRate(
      sourceCurrency,
      targetCurrency
    );

    expect(rate.toString()).to.be.eq(valueFromExchange);
    expect(fakeExchangeAPI.queryExchangeRate).to.have.been.calledWithExactly(
      sourceCurrency,
      targetCurrency
    );
  });

  it('should store the value if it is not cached', async function () {
    const cache = new Map<string, RateWithExpiration>();
    const cachedExchangeApi = new ExchangeApiCache(fakeExchangeAPI, 100, cache);
    const rate = await cachedExchangeApi.queryExchangeRate(
      sourceCurrency,
      targetCurrency
    );
    const key = getKeyFromArgs(sourceCurrency, targetCurrency);

    expect(rate.toString()).to.be.eq(valueFromExchange);
    expect(cache.get(key)?.rate.toString()).to.be.eq(valueFromExchange);
  });

  it('should perform a call to the inner exchange if the cached value is expired', async function () {
    const previouslyStoredValue = 100;
    const cache: Map<string, RateWithExpiration> = new Map();
    const key = getKeyFromArgs(sourceCurrency, targetCurrency);
    // 1 second ago
    const expirationTime = Date.now() - 1_000;
    cache.set(key, {
      rate: new BigNumber(previouslyStoredValue),
      expirationTime,
    });
    const cachedExchangeApi = new ExchangeApiCache(fakeExchangeAPI, 100, cache);
    const rate = await cachedExchangeApi.queryExchangeRate(
      sourceCurrency,
      targetCurrency
    );

    expect(rate.toString()).to.be.eq(valueFromExchange);

    expect(fakeExchangeAPI.queryExchangeRate).to.have.been.calledWithExactly(
      sourceCurrency,
      targetCurrency
    );
    expect(cache.get(key)?.rate.toString()).to.be.eq(valueFromExchange);
  });

  it('should not perform a call to the inner exchange if the cached value is not expired', async function () {
    const cache: Map<string, RateWithExpiration> = new Map();
    const key = getKeyFromArgs(sourceCurrency, targetCurrency);
    // in 10 seconds
    const expirationTime = Date.now() + 10_000;
    const cachedRate = new BigNumber(100);
    cache.set(key, {
      rate: cachedRate,
      expirationTime,
    });
    const cachedExchangeApi = new ExchangeApiCache(fakeExchangeAPI, 100, cache);
    const rate = await cachedExchangeApi.queryExchangeRate(
      sourceCurrency,
      targetCurrency
    );

    expect(rate.toString()).to.be.eq(cachedRate.toString());

    expect(fakeExchangeAPI.queryExchangeRate).not.to.have.been.called;
  });
});
