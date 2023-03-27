import { AxiosError } from 'axios';
import BigNumber from 'bignumber.js';
import BaseExchangeApi, { CurrencyMapping } from './ExchangeApi';
import HttpWrapper from '../HttpWrapper';

const BASE_URL = 'https://api.coinbase.com/';
const PRICE_API_PATH = '/v2/exchange-rates';

export type CoinBaseResponse = {
    data: {
        currency: string;
        rates: Record<string, string>;
    };
};

type CoinBaseError = {
    id: string;
    message: string;
};

export type CoinBaseErrorResponse = {
    errors: Array<CoinBaseError>;
};

const CURRENCY_MAPPING: CurrencyMapping = {
    RIF: 'RIF',
    TRIF: 'RIF'
};

export default class CoinBase extends BaseExchangeApi {
    constructor(
        private readonly _httpWrapper: HttpWrapper = new HttpWrapper(),
        private readonly _baseUrl = BASE_URL
    ) {
        super('CoinBase', CURRENCY_MAPPING, ['RIF', 'tRif']);
    }

    async queryExchangeRate(
        sourceCurrency: string,
        targetCurrency: string
    ): Promise<BigNumber> {
        const upperCaseTargetCurrency = targetCurrency.toUpperCase();
        let response: CoinBaseResponse;

        try {
            const url = new URL(this._baseUrl);
            url.pathname = PRICE_API_PATH;
            url.searchParams.append('currency', sourceCurrency);
            response = await this._httpWrapper.sendPromise<CoinBaseResponse>(
                url.toString()
            );
        } catch (error: unknown) {
            const { response } = error as AxiosError;

            if (!response) {
                throw new Error('No response received from CoinBase API');
            }

            throw Error(`CoinBase API status ${response.status}`);
        }

        const {
            data: { rates }
        } = response;
        const conversionRate = rates[upperCaseTargetCurrency];

        if (!conversionRate) {
            throw Error(
                `Exchange rate for currency pair ${sourceCurrency}/${targetCurrency} is not available`
            );
        }

        return new BigNumber(conversionRate);
    }
}
