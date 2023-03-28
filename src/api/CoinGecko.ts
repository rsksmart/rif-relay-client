import { AxiosError } from 'axios';
import BigNumber from 'bignumber.js';
import BaseExchangeApi, { CurrencyMapping } from './ExchangeApi';
import HttpWrapper from '../HttpWrapper';

const BASE_URL = 'https://api.coingecko.com/';
const PRICE_API_PATH = '/api/v3/simple/price';

export type CoinGeckoResponse = Record<string, Record<string, string>>;

export const COINGECKO_RBTC_ID = 'rootstock';
export const COINGECKO_RIF_TOKEN_ID = 'rif-token';

const CURRENCY_MAPPING: CurrencyMapping = {
    RIF: COINGECKO_RIF_TOKEN_ID,
    RBTC: COINGECKO_RBTC_ID,
    TRIF: COINGECKO_RIF_TOKEN_ID
};

export default class CoinGecko extends BaseExchangeApi {
    private _url: URL;

    constructor(
        private readonly _httpWrapper: HttpWrapper = new HttpWrapper(),
        private readonly _baseUrl = BASE_URL,
        private readonly _priceApiPath = PRICE_API_PATH
    ) {
        super('CoinGecko', CURRENCY_MAPPING, ['RIF', 'RBTC', 'tRif']);
        this._url = new URL(this._priceApiPath, this._baseUrl);
    }

    async queryExchangeRate(
        sourceCurrency: string,
        targetCurrency: string
    ): Promise<BigNumber> {
        let response: CoinGeckoResponse;
        // TODO: We could check if the target currency is supported by calling the /simple/supported_vs_currencies API
        const currencyId = targetCurrency.toLowerCase();

        try {
            const url = new URL(this._priceApiPath, this._url);
            url.searchParams.append('ids', sourceCurrency);
            url.searchParams.append('vs_currencies', currencyId);
            response = await this._httpWrapper.sendPromise<CoinGeckoResponse>(
                url.toString()
            );
        } catch (error: unknown) {
            const { response } = error as AxiosError;

            if (!response) {
                throw new Error('No response received from CoinGecko API');
            }

            throw Error(`CoinGecko API status ${response.status}`);
        }

        if (!response[sourceCurrency]?.[currencyId]) {
            throw Error(
                `Exchange rate for currency pair ${sourceCurrency}/${currencyId} is not available`
            );
        }

        // It cannot be undefined due to the previous check
        const conversionRate = response[sourceCurrency]?.[currencyId] as string;

        return BigNumber(conversionRate);
    }
}
