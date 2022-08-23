import { SourceApi } from './types/RelayPricer';

export default class RelayPricer {
    private readonly sourceApi: SourceApi;

    constructor(sourceApi: SourceApi) {
        this.sourceApi = sourceApi;
    }

    async getPrice(
        sourceCurrency: string,
        targetCurrency: string,
        intermediateCurrency?: string
    ): Promise<number> {
        const intermediary = intermediateCurrency
            ? intermediateCurrency
            : 'USD';

        const [sourcePrice, targetPrice] = await Promise.all([
            this.sourceApi.query(sourceCurrency, intermediary),
            this.sourceApi.query(targetCurrency, intermediary)
        ]);
        if (sourcePrice === 0 || targetPrice === 0) {
            throw new Error('price cannot be zero');
        }
        return sourcePrice / targetPrice;
    }
}
