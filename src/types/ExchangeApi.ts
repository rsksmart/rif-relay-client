import BigNumber from 'bignumber.js';

export interface ExchangeApi {
    getApiTokenName(tokenSymbol: string): string;

    query(sourceCurrency: string, targetCurrency: string): Promise<BigNumber>;
}
