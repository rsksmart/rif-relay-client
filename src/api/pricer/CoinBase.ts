import type { ResponseError } from 'superagent';
import { BigNumber as BigNumberJs } from 'bignumber.js';
import BaseExchangeApi from './BaseExchangeApi';
import HttpWrapper from '../common/HttpWrapper';

const BASE_URL = 'https://api.coinbase.com/';
const PRICE_API_PATH = '/v2/exchange-rates';

export type CoinBaseResponse = {
  data: {
    currency: string;
    rates: Record<string, string>;
  };
};

export default class CoinBase extends BaseExchangeApi {
  private _url: URL;

  constructor(
    public readonly _httpWrapper: HttpWrapper = new HttpWrapper(),
    private readonly _baseUrl = BASE_URL,
    private readonly _priceApiPath = PRICE_API_PATH
  ) {
    super('CoinBase', { RIF: 'RIF', TRIF: 'RIF' });
    this._url = new URL(this._priceApiPath, this._baseUrl);
  }

  async queryExchangeRate(
    sourceCurrency: string,
    targetCurrency: string
  ): Promise<BigNumberJs> {
    let response: CoinBaseResponse;
    const sourceCurrencyName = this._getCurrencyName(sourceCurrency);
    const targetCurrencyName = targetCurrency.toUpperCase();

    try {
      const url = new URL(this._priceApiPath, this._url);
      url.searchParams.append('currency', sourceCurrencyName);
      response = await this._httpWrapper.sendPromise<CoinBaseResponse>(
        url.toString()
      );
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

    const conversionRate = rates[targetCurrencyName];

    if (!conversionRate) {
      throw Error(
        `Exchange rate for currency pair ${sourceCurrency}/${targetCurrency} is not available`
      );
    }

    return BigNumberJs(conversionRate);
  }
}
