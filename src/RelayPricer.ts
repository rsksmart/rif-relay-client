import BigNumber from 'bignumber.js';
import CoinBase from './api/CoinBase';
import RdocExchange from './api/RdocExchange';
import TestExchange from './api/TestExchange';
import ExchangeApi from './types/ExchangeApi';

const INTERMEDIATE_CURRENCY = 'USD';

const coinbase = new CoinBase();
const testExchange = new TestExchange();
const rdocExchange = new RdocExchange();

type AvailableApi = {
    api: ExchangeApi;
    tokens: Array<string>;
};

const EXCHANGE_APIS: Array<AvailableApi> = [
    {
        api: coinbase,
        tokens: ['RIF']
    },
    {
        api: testExchange,
        tokens: ['TKN']
    },
    {
        api: rdocExchange,
        tokens: ['RDOC']
    }
];

export default class RelayPricer {
    findAvailableApi(token: string): AvailableApi {
        const availableApi = EXCHANGE_APIS.find((x) =>
            x.tokens.includes(token)
        );
        if (!availableApi) {
            throw Error(`There is no available API for token ${token}`);
        }
        return availableApi;
    }

    async getExchangeRate(
        sourceCurrency: string,
        targetCurrency: string,
        intermediateCurrency?: string
    ): Promise<BigNumber> {
        const { api: sourceApi } = this.findAvailableApi(sourceCurrency);

        const source = sourceApi.getApiTokenName(sourceCurrency);
        const target = sourceApi.getApiTokenName(targetCurrency);

        const intermediary = intermediateCurrency
            ? intermediateCurrency
            : INTERMEDIATE_CURRENCY;

        const [sourceExchangeRate, targetExchangeRate] = await Promise.all([
            sourceApi.queryExchangeRate(source, intermediary),
            sourceApi.queryExchangeRate(target, intermediary)
        ]);
        if (
            sourceExchangeRate.isEqualTo(0) ||
            targetExchangeRate.isEqualTo(0)
        ) {
            throw Error(
                `Currency conversion for pair ${sourceCurrency}:${targetCurrency} not found in current exchange api`
            );
        }
        return sourceExchangeRate.dividedBy(targetExchangeRate);
    }
}
