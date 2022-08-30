import { ExchangeApi } from '../types/ExchangeApi';
import fetch, { Response } from 'node-fetch';
import BigNumber from 'bignumber.js';

const URL = 'https://api.coinbase.com/v2/exchange-rates';

export type CoinBaseResponse = {
    data: {
        currency: string;
        rates: Record<string, string>;
    };
};

const CURRENCY_MAPPING: Record<string, string> = {
    RIF: 'RIF',
    RBTC: 'RBTC',
    TKN: 'RIF'
};

export class CoinBase implements ExchangeApi {
    getApiTokenName(tokenSymbol: string): string {
        if (!tokenSymbol) {
            throw Error('ExchangeApi cannot map a token with a null value');
        }
        const resultMapping = CURRENCY_MAPPING[tokenSymbol];
        if (resultMapping) {
            return resultMapping;
        }
        return tokenSymbol;
    }

    async query(
        sourceCurrency: string,
        targetCurrency: string
    ): Promise<BigNumber> {
        const upperCaseTargetCurrency = targetCurrency.toUpperCase();
        const response: Response = await fetch(
            `${URL}?currency=${sourceCurrency}`,
            {
                method: 'get'
            }
        );

        if (!response.ok) {
            throw Error(
                `Coinbase API does not recognise given currency ${sourceCurrency}`
            );
        }

        const {
            data: { rates }
        }: CoinBaseResponse = await response.json();
        const conversionRate = rates[upperCaseTargetCurrency];

        if (!conversionRate) {
            throw Error(
                `Exchange rate for currency pair ${sourceCurrency}/${targetCurrency} is not available`
            );
        }

        return new BigNumber(conversionRate);
    }
}
