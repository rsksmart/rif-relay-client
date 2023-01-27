import { BigNumber as BigNumberJs } from 'bignumber.js';
import BaseExchangeApi, { CurrencyMapping } from './ExchangeApi';

type RateRecord = Record<string, string>;

const rates: Record<string, RateRecord> = {
  RDOC: {
    USD: '1',
  },
};

const CURRENCY_MAPPING: CurrencyMapping = {
  RDOC: 'RDOC',
};

export default class RdocExchange extends BaseExchangeApi {
  constructor() {
    super('RdocExchange', CURRENCY_MAPPING, ['RDOC']);
  }

  queryExchangeRate(
    sourceCurrency: string,
    targetCurrency: string
  ): BigNumberJs {
    const conversionRate =
      rates[sourceCurrency.toUpperCase()]?.[targetCurrency.toUpperCase()];

    if (!conversionRate) {
      throw Error(
        `Exchange rate for currency pair ${sourceCurrency} / ${targetCurrency} is not available`
      );
    }

    return BigNumberJs(conversionRate);
  }
}
