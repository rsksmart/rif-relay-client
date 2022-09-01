import { ExchangeApi } from '../types/ExchangeApi';
import BigNumber from 'bignumber.js';

type RateRecord = Record<string, string>;

const rates: Record<string, RateRecord> = {
    TKN: {
        USD: '0.0775886924643371'
    },
    RBTC: {
        USD: '23345.834630269488'
    }
};

export class TestExchange implements ExchangeApi {
    getApiTokenName(tokenSymbol: string): string {
        return tokenSymbol;
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
