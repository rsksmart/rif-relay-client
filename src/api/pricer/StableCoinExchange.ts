import { BigNumber as BigNumberJs } from 'bignumber.js';
import BaseExchangeApi, { CurrencyMapping } from './BaseExchangeApi';

export type RateRecord = Record<string, string>;

export abstract class StableCoinExchange extends BaseExchangeApi {
  protected rates: Record<string, RateRecord> = {};

  constructor(
    protected sourceToken: string,
    api: string,
    currencyMapping: CurrencyMapping
  ) {
    super(api, currencyMapping);
    this.rates[sourceToken] = {
      USD: '1',
    };
  }

  queryExchangeRate(
    sourceCurrency: string,
    targetCurrency: string
  ): Promise<BigNumberJs> {
    const conversionRate =
      this.rates[sourceCurrency.toUpperCase()]?.[targetCurrency.toUpperCase()];

    if (!conversionRate) {
      throw Error(
        `Exchange rate for currency pair ${sourceCurrency} / ${targetCurrency} is not available`
      );
    }

    return Promise.resolve(BigNumberJs(conversionRate));
  }
}
