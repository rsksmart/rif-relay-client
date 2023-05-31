import type BaseExchangeApi from "./BaseExchangeApi";

export class CachedExchangeApi {
    constructor(private exchangeApi: BaseExchangeApi, private expirationTimeInSec: number) {}

    public queryExchangeRate(
        sourceCurrency: string,
        targetCurrency: string
      ): Promise<BigNumberJs> {
        throw new Error('Not implemented yet');
      }
}