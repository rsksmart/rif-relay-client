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

export class CoinBase implements ExchangeApi {
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
            throw new Error(
                `Coinbase API does not recognise given currency ${sourceCurrency}`
            );
        }

        const {
            data: { rates }
        }: CoinBaseResponse = await response.json();
        const conversionRate = rates[upperCaseTargetCurrency];

        if (!conversionRate) {
            throw new Error(
                `Exchange rate for currency pair ${sourceCurrency}/${targetCurrency} is not available`
            );
        }

        return new BigNumber(conversionRate);
    }
}
