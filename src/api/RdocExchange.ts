import BigNumber from 'bignumber.js';
import BaseExchangeApi from './BaseExchangeApi';

type RateRecord = Record<string, string>;

const rates: Record<string, RateRecord> = {
    RDOC: {
        USD: '1'
    }
};

const CURRENCY_MAPPING: Record<string, string> = {
    RDOC: 'RDOC'
};

export default class RdocExchange extends BaseExchangeApi {
    constructor() {
        super('RdocExchange', CURRENCY_MAPPING, ['RDOC']);
    }

    async queryExchangeRate(
        sourceCurrency: string,
        targetCurrency: string
    ): Promise<BigNumber> {
        const conversionRate =
            rates[sourceCurrency.toUpperCase()][targetCurrency.toUpperCase()];

        if (!conversionRate) {
            throw Error(
                `Exchange rate for currency pair ${sourceCurrency} / ${targetCurrency} is not available`
            );
        }

        return new BigNumber(conversionRate);
    }
}
