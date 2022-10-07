import BigNumber from 'bignumber.js';
import ExchangeApi from '../types/ExchangeApi';
import BaseExchangeApi from './BaseExchangeApi';

type RateRecord = Record<string, string>;

const rates: Record<string, RateRecord> = {
    TKN: {
        USD: '0.0775886924643371'
    },
    RBTC: {
        USD: '23345.834630269488'
    }
};

const CURRENCY_MAPPING: Record<string, string> = {
    TKN: 'TKN',
    RBTC: 'RBTC'
};

export default class TestExchange
    extends BaseExchangeApi
    implements ExchangeApi
{
    constructor() {
        super('TestExchange', CURRENCY_MAPPING);
    }

    async queryExchangeRate(
        sourceCurrency: string,
        targetCurrency: string
    ): Promise<BigNumber> {
        const conversionRate = rates[sourceCurrency][targetCurrency];
        if (!conversionRate) {
            throw Error(
                `TestExchange API does not recognise given currency ${sourceCurrency}`
            );
        }
        return new BigNumber(conversionRate);
    }
}
