import type { BigNumber as BigNumberJs } from 'bignumber.js';

export type BaseCurrency = 'TRIF' | 'RIF' | 'RDOC' | 'RBTC' | 'TKN';

export type CurrencyMapping = Partial<Record<BaseCurrency, string>>;

export default abstract class BaseExchangeApi {
  constructor(
    protected readonly api: string,
    private currencyMapping: CurrencyMapping
  ) {}

  protected _getCurrencyName(tokenSymbol: string): string {
    if (!tokenSymbol) {
      throw Error(`${this.api} API cannot map a token with a null/empty value`);
    }

    const upperCaseTokenSymbol = tokenSymbol.toUpperCase();

    const currency = this.currencyMapping[upperCaseTokenSymbol as BaseCurrency];

    return currency ?? tokenSymbol;
  }

  abstract queryExchangeRate(
    sourceCurrency: string,
    targetCurrency: string
  ): Promise<BigNumberJs>;
}
