import BigNumber from 'bignumber.js';

export interface ExchangeApi {
    query(sourceCurrency: string, targetCurrency: string): Promise<BigNumber>;
}
