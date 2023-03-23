import type { ResponseError } from 'superagent';
import { BigNumber as BigNumberJs } from 'bignumber.js';
import BaseExchangeApi, { CurrencyMapping } from './ExchangeApi';
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
  constructor(
    private readonly _httpWrapper: HttpWrapper = new HttpWrapper(),
    private readonly _baseUrl = BASE_URL
  ) {
    super('CoinGecko', CURRENCY_MAPPING, ['RIF', 'RBTC', 'tRif']);
  }

  async queryExchangeRate(
    sourceCurrency: string,
    targetCurrency: string
  ): Promise<BigNumberJs> {
    let response: CoinGeckoResponse;
    // TODO: We could check if the target currency is supported by calling the /simple/supported_vs_currencies API
    const currencyId = targetCurrency.toLowerCase();

    try {
      const url = new URL(this._baseUrl);
      url.pathname = PRICE_API_PATH;
      url.searchParams.append('ids', sourceCurrency);
      url.searchParams.append('vs_currencies', currencyId);
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

    if (!response[sourceCurrency]?.[targetCurrency]) {
      throw Error(
        `Exchange rate for currency pair ${sourceCurrency}/${targetCurrency} is not available`
      );
    }

    // It cannot be undefined due to the previous check
    const conversionRate = response[sourceCurrency]?.[targetCurrency] as string;

    return BigNumberJs(conversionRate);
  }
}
