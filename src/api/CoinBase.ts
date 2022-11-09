import axios, { AxiosError } from 'axios';
import { AxiosResponse } from 'axios';
import BigNumber from 'bignumber.js';
import BaseExchangeApi from './ExchangeApi';

const URL = 'https://api.coinbase.com/v2/exchange-rates';

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

const CURRENCY_MAPPING: Record<string, string> = {
    RIF: 'RIF',
    RBTC: 'RBTC'
};

export default class CoinBase extends BaseExchangeApi {
    constructor() {
        super('CoinBase', CURRENCY_MAPPING, ['RIF', 'RBTC']);
    }

    async queryExchangeRate(
        sourceCurrency: string,
        targetCurrency: string
    ): Promise<BigNumber> {
        const upperCaseTargetCurrency = targetCurrency.toUpperCase();
        let response: AxiosResponse;

        try {
            response = await axios.get(`${URL}?currency=${sourceCurrency}`);
        } catch (error: unknown) {
            const { response } = error as AxiosError;
            throw Error(
                `CoinBase API status ${response.status}/${response.statusText}`
            );
        }

        const {
            data: { rates }
        }: CoinBaseResponse = await response.data;
        const conversionRate = rates[upperCaseTargetCurrency];

        if (!conversionRate) {
            throw Error(
                `Exchange rate for currency pair ${sourceCurrency}/${targetCurrency} is not available`
            );
        }

        return new BigNumber(conversionRate);
    }
}
