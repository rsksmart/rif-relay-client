import BigNumber from 'bignumber.js';

export default abstract class BaseExchangeApi {
    private currencyMapping: Record<string, string>;
    protected api: string;
    private tokens: string[];

    constructor(
        api: string,
        currencyMapping: Record<string, string>,
        tokens: string[]
    ) {
        this.api = api;
        this.currencyMapping = currencyMapping;
        this.tokens = tokens;
    }

    getApiTokenName(tokenSymbol: string): string {
        if (!tokenSymbol) {
            throw Error(
                `${this.api} API cannot map a token with a null/empty value`
            );
        }
        const upperCaseTokenSymbol = tokenSymbol.toUpperCase();
        const resultMapping = this.currencyMapping[upperCaseTokenSymbol];
        if (!resultMapping) {
            throw Error(
                `Token ${upperCaseTokenSymbol} is not internally mapped in ${this.api} API`
            );
        }
        return resultMapping;
    }

    getTokens(): string[] {
        return this.tokens;
    }

    abstract queryExchangeRate(
        sourceCurrency: string,
        targetCurrency: string
    ): Promise<BigNumber>;
}
