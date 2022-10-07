export default abstract class BaseExchangeApi {
    private currencyMapping: Record<string, string>;
    protected api: string;

    constructor(api: string, currencyMapping: Record<string, string>) {
        this.api = api;
        this.currencyMapping = currencyMapping;
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
}
