import BigNumber from 'bignumber.js';

export interface ExchangeApi {
    getApiTokenName(tokenSymbol: string): string;

    queryExchangeRate(
        sourceCurrency: string,
        targetCurrency: string
    ): Promise<BigNumber>;
}
