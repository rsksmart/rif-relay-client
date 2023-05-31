import type { ExchangeApi } from './BaseExchangeApi';
import type { BigNumber as BigNumberJs } from 'bignumber.js';

export type CacheValue<T> = {
  value: T;
  expirationTime: number;
};

export class CachedExchangeApi implements ExchangeApi {
  constructor(
    private exchangeApi: ExchangeApi,
    private expirationTimeInMillisec: number,
    private cache: Map<string, CacheValue<BigNumberJs>> = new Map<
      string,
      CacheValue<BigNumberJs>
    >()
  ) {}

  public async queryExchangeRate(
    sourceCurrency: string,
    targetCurrency: string
  ): Promise<BigNumberJs> {
    const key = getKeyFromArgs(sourceCurrency, targetCurrency);
    const now = Date.now();
    const cachedValue = this.cache.get(key);
    if (!cachedValue || cachedValue.expirationTime <= now) {
      const value = await this.exchangeApi.queryExchangeRate(
        sourceCurrency,
        targetCurrency
      );
      const expirationTime = now + this.expirationTimeInMillisec;
      this.cache.set(key, { expirationTime, value });

      return value;
    }

    return cachedValue.value;
  }
}

export const getKeyFromArgs = (
  sourceCurrency: string,
  targetCurrency: string
) => `${sourceCurrency}->${targetCurrency}`;
