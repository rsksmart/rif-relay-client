import { CoinBaseResponse, SourceApi } from '../types/RelayPricer';
import fetch, { Response } from 'node-fetch';

export default class CoinBase implements SourceApi {
    // we should get this address from config file or enviroments
    private readonly URL: string = 'https://api.coinbase.com/v2/exchange-rates';

    async query(input: string, output: string): Promise<number> {
        output = output.toUpperCase();
        const response: Response = await fetch(
            `${this.URL}?currency=${input}`,
            {
                method: 'get'
            }
        );

        if (response.status === 200) {
            const result: CoinBaseResponse =
                (await response.json()) as CoinBaseResponse;
            if (!(output in result.data.rates)) {
                throw new Error('Output not available');
            }
            return Number(result.data.rates[output]);
        }
        throw new Error('Input not available');
    }
}
