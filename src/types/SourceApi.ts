import BigNumber from 'bignumber.js';

export interface SourceApi {
    query(sourceCurrency: string, targetCurrency: string): Promise<BigNumber>;
}
