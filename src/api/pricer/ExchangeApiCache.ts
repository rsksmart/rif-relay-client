import log from 'loglevel';
import type { ExchangeApi } from './BaseExchangeApi';
import type { BigNumber as BigNumberJs } from 'bignumber.js';

export type RateWithExpiration = {
  rate: BigNumberJs;
  expirationTime: number;
};

export class ExchangeApiCache implements ExchangeApi {
  constructor(
    private exchangeApi: ExchangeApi,
    private expirationTimeInMillisec: number,
    private cache: Map<string, RateWithExpiration> = new Map<
      string,
      RateWithExpiration
    >()
  ) {}

  public async queryExchangeRate(
    sourceCurrency: string,
    targetCurrency: string
  ): Promise<BigNumberJs> {
    const key = getKeyFromArgs(sourceCurrency, targetCurrency);
    const now = Date.now();
    const cachedRate = this.cache.get(key);
    if (!cachedRate || cachedRate.expirationTime <= now) {
      log.debug(
        'CachedExchangeApi: value not available or expired',
        cachedRate
      );
      const rate = await this.exchangeApi.queryExchangeRate(
        sourceCurrency,
        targetCurrency
      );
      const expirationTime = now + this.expirationTimeInMillisec;
      this.cache.set(key, { expirationTime, rate });
      log.debug('ExchangeApiCache: storing a new value', key, {
        expirationTime,
        rate,
      });

      return rate;
    }
    log.debug(
      'ExchangeApiCache: value available in cache, API not called',
      cachedRate
    );

    return cachedRate.rate;
  }
}

export const getKeyFromArgs = (
  sourceCurrency: string,
  targetCurrency: string
) => `${sourceCurrency}->${targetCurrency}`;
