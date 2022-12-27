import { BigNumber as BigNumberJs } from 'bignumber.js';
import BaseExchangeApi, { CurrencyMapping } from './ExchangeApi';

type RateRecord = Record<string, string>;

const rates: Record<string, RateRecord> = {
    TKN: {
        USD: '0.0775886924643371'
    }
};

const CURRENCY_MAPPING: CurrencyMapping = {
    TKN: 'TKN',
    RBTC: 'RBTC'
};

export default class TestExchange extends BaseExchangeApi {
    constructor() {
        super('TestExchange', CURRENCY_MAPPING, ['TKN']);
    }

    queryExchangeRate(
        sourceCurrency: string,
        targetCurrency: string
    ): BigNumberJs {
        const conversionRate = rates[sourceCurrency]?.[targetCurrency];
        if (!conversionRate) {
            throw Error(
                `TestExchange API does not recognise given currency ${sourceCurrency}`
            );
        }

        return BigNumberJs(conversionRate);
    }
}
