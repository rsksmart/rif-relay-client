import type { ResponseError } from 'superagent';
import { BigNumber as BigNumberJs } from 'bignumber.js';
import BaseExchangeApi, { CurrencyMapping } from './BaseExchangeApi';
import HttpWrapper from '../common/HttpWrapper';

const BASE_URL = 'https://api.coingecko.com/';
const PRICE_API_PATH = '/api/v3/simple/price';

export type CoinGeckoResponse = Record<string, Record<string, string>>;

export const COINGECKO_RBTC_ID = 'rootstock';
export const COINGECKO_RIF_TOKEN_ID = 'rif-token';

const CURRENCY_MAPPING: CurrencyMapping = {
  RIF: COINGECKO_RIF_TOKEN_ID,
  RBTC: COINGECKO_RBTC_ID,
  TRIF: COINGECKO_RIF_TOKEN_ID,
};

export default class CoinGecko extends BaseExchangeApi {
  private _url: URL;

  constructor(
    public readonly _httpWrapper: HttpWrapper = new HttpWrapper(),
    private readonly _baseUrl = BASE_URL,
    private readonly _priceApiPath = PRICE_API_PATH
  ) {
    super('CoinGecko', CURRENCY_MAPPING);
    this._url = new URL(this._priceApiPath, this._baseUrl);
  }

  async queryExchangeRate(
    sourceCurrency: string,
    targetCurrency: string
  ): Promise<BigNumberJs> {
    let response: CoinGeckoResponse;
    // TODO: We could check if the target currency is supported by calling the /simple/supported_vs_currencies API
    const sourceCurrencyName = this._getCurrencyName(sourceCurrency);
    const targetCurrencyName = targetCurrency.toLowerCase();

    try {
      const url = new URL(this._priceApiPath, this._url);
      url.searchParams.append('ids', sourceCurrencyName);
      url.searchParams.append('vs_currencies', targetCurrencyName);
      response = await this._httpWrapper.sendPromise<CoinGeckoResponse>(
        url.toString()
      );
    } catch (error: unknown) {
      const { response } = error as ResponseError;

      if (!response) {
        throw new Error('No response received from CoinGecko API');
      }

      throw Error(`CoinGecko API status ${response.status}`);
    }

    if (!response[sourceCurrencyName]?.[targetCurrencyName]) {
      throw Error(
        `Exchange rate for currency pair ${sourceCurrency}/${targetCurrency} is not available`
      );
    }

    // It cannot be undefined due to the previous check
    const conversionRate = response[sourceCurrencyName]?.[
      targetCurrencyName
    ] as string;

    return BigNumberJs(conversionRate);
  }
}
