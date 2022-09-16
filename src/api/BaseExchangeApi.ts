import BigNumber from 'bignumber.js';

export default abstract class BaseExchangeApi {
    constructor(
        protected readonly api: string,
        private currencyMapping: Record<string, string>,
        public readonly tokens: string[]
    ) {}

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

    abstract queryExchangeRate(
        sourceCurrency: string,
        targetCurrency: string
    ): Promise<BigNumber>;
}
