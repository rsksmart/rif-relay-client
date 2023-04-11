import type { ResponseError } from 'superagent';
import { BigNumber as BigNumberJs } from 'bignumber.js';
import BaseExchangeApi from './BaseExchangeApi';
import HttpWrapper from '../common/HttpWrapper';

const BASE_URL = 'https://coincodex.com/';
const PRICE_API_PATH = '/api/coincodex/get_coin';

export type CoinCodexResponse = {
  last_price_usd: string;
};

export default class CoinCodex extends BaseExchangeApi {
  private _url: URL;

  constructor(
    public readonly _httpWrapper: HttpWrapper = new HttpWrapper(),
    private readonly _baseUrl = BASE_URL,
    private readonly _priceApiPath = PRICE_API_PATH
  ) {
    super('CoinCodex', { RIF: 'RIF', TRIF: 'RIF', RBTC: 'RBTC' });
    this._url = new URL(this._priceApiPath, this._baseUrl);
  }

  async queryExchangeRate(
    sourceCurrency: string,
    targetCurrency: string
  ): Promise<BigNumberJs> {
    let response: CoinCodexResponse;
    const sourceCurrencyName = this._getCurrencyName(sourceCurrency);
    const targetCurrencyName = targetCurrency.toUpperCase();

    if (targetCurrencyName !== 'USD') {
      throw Error(
        `Exchange rate for currency pair ${sourceCurrency}/${targetCurrency} is not available`
      );
    }

    try {
      response = await this._httpWrapper.sendPromise<CoinCodexResponse>(
        `${this._url.toString()}/${sourceCurrencyName}`
      );
    } catch (error: unknown) {
      const { response } = error as ResponseError;

      if (!response) {
        throw new Error('No response received from CoinCodex API');
      }

      throw Error(`CoinCodex API status ${response.status}`);
    }

    const { last_price_usd: lastPriceUsd }: CoinCodexResponse = response;

    return BigNumberJs(lastPriceUsd);
  }
}
