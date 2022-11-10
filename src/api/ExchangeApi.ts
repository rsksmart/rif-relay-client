import BigNumber from 'bignumber.js';

const avialableCurrencies = ['TRIF', 'RIF', 'RDOC', 'RBTC', 'TKN'] as const;

export type FromCurrency = typeof avialableCurrencies[number];

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

        const currency = avialableCurrencies.find(
            (c) => c === upperCaseTokenSymbol
        );
        if (!currency) {
            throw Error(
                `Token ${upperCaseTokenSymbol} is not internally mapped in ${this.api} API`
            );
        }

        return this.currencyMapping[currency];
    }

    abstract queryExchangeRate(
        sourceCurrency: string,
        targetCurrency: string
    ): Promise<BigNumber>;
}
