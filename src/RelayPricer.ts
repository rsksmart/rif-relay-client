import CoinBase from './api/CoinBase';
import { SourceApi } from './types/RelayPricer';

export default class RelayPricer {
    private readonly sourceApi: SourceApi;

    constructor(sourceApi: SourceApi | string) {
        if (typeof sourceApi === 'string' || sourceApi instanceof String) {
            switch (sourceApi as string) {
                case 'coinbase':
                    this.sourceApi = new CoinBase();
                    break;
                default:
                    throw new Error('Source api not provided');
            }
        } else {
            this.sourceApi = sourceApi as SourceApi;
        }
    }

    async getPrice(
        pair1: string,
        pair2: string,
        intermediaryPair?: string
    ): Promise<number> {
        const intermediary = intermediaryPair ? intermediaryPair : 'USD';
        const price1 = await this.sourceApi.query(pair1, intermediary);
        const price2 = await this.sourceApi.query(pair2, intermediary);
        if (price1 === 0 || price2 === 0) {
            throw new Error('price cannot be zero');
        }
        return price1 / price2;
    }
}
