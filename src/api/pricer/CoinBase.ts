import type { ResponseError } from 'superagent';
import { BigNumber as BigNumberJs } from 'bignumber.js';
import BaseExchangeApi, { CurrencyMapping } from './ExchangeApi';
// import HttpWrapper from '../common/HttpWrapper';

// const URL = 'https://api.coinbase.com/v2/exchange-rates';

export type CoinBaseResponse = {
  data: {
    currency: string;
    rates: Record<string, string>;
  };
};

const CURRENCY_MAPPING: CurrencyMapping = {
  RIF: 'RIF',
  RBTC: 'RBTC',
  TRIF: 'RIF',
};

export default class CoinBase extends BaseExchangeApi {
  // private readonly _httpWrapper: HttpWrapper;

  constructor(/*httpWrapper: HttpWrapper = new HttpWrapper()*/) {
    super('CoinBase', CURRENCY_MAPPING, ['RIF', 'RBTC', 'tRif']);
    // this._httpWrapper = httpWrapper;
  }

  async queryExchangeRate(
    sourceCurrency: string,
    targetCurrency: string
  ): Promise<BigNumberJs> {
    const upperCaseTargetCurrency = targetCurrency.toUpperCase();
    let response: CoinBaseResponse;

    try {
      /* response =await this._httpWrapper.sendPromise<CoinBaseResponse>(
        `${URL}?currency=${sourceCurrency}`
      );*/
      response = await Promise.resolve({
        data: {
          currency: 'RBTC',
          rates: {
            'USD': '22096.37'
          },
        }
      });
    } catch (error: unknown) {
      const { response } = error as ResponseError;

      if (!response) {
        throw new Error('No response received from CoinBase API');
      }

      throw Error(`CoinBase API status ${response.status}`);
    }

    const {
      data: { rates },
    }: CoinBaseResponse = response;
    const conversionRate = rates[upperCaseTargetCurrency];
    console.log('conversionRate: ', conversionRate);

    if (!conversionRate) {
      throw Error(
        `Exchange rate for currency pair ${sourceCurrency}/${targetCurrency} is not available`
      );
    }

    const returnValue = BigNumberJs(conversionRate);
    console.log('ConversionRate to BigNumberJS', returnValue.toString());
    
    return returnValue;
  }
}
