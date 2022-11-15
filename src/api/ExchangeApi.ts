import BigNumber from 'bignumber.js';

// All FromCurrency tokens should be in uppercases as we uppercase it before doing the request
export type FromCurrency = 'TRIF' | 'RIF' | 'RDOC' | 'RBTC' | 'TKN';

export type CurrencyMapping = Partial<Record<FromCurrency, string>>;

export default abstract class BaseExchangeApi {
    public readonly tokens: string[];

    constructor(
        protected readonly api: string,
        private currencyMapping: CurrencyMapping,
        tokens: string[]
    ) {
        this.tokens = tokens.map((token) => token.toUpperCase());
    }

    getApiTokenName(tokenSymbol: string): string {
        if (!tokenSymbol) {
            throw Error(
                `${this.api} API cannot map a token with a null/empty value`
            );
        }

        const upperCaseTokenSymbol = tokenSymbol.toUpperCase();

        const currency =
            this.currencyMapping[upperCaseTokenSymbol as FromCurrency];

        if (!currency) {
            throw Error(
                `Token ${upperCaseTokenSymbol} is not internally mapped in ${this.api} API`
            );
        }

        return currency;
    }

    abstract queryExchangeRate(
        sourceCurrency: string,
        targetCurrency: string
    ): Promise<BigNumber>;
}
