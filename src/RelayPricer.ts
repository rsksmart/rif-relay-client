import BigNumber from 'bignumber.js';
import BaseExchangeApi from './api/ExchangeApi';
import CoinBase from './api/CoinBase';
import RdocExchange from './api/RdocExchange';
import TestExchange from './api/TestExchange';
import CoinGecko from './api/CoinGecko';
import HttpWrapper from './HttpWrapper';

const INTERMEDIATE_CURRENCY = 'USD';

const testExchange = new TestExchange();
const rdocExchange = new RdocExchange();

const EXCHANGE_APIS: BaseExchangeApi[] = [testExchange, rdocExchange];

export default class RelayPricer {
    constructor(
        private readonly _httpWrapper: HttpWrapper = new HttpWrapper()
    ) {
        const coinGecko = new CoinGecko(_httpWrapper);
        const coinBase = new CoinBase(_httpWrapper);
        EXCHANGE_APIS.push(...[coinGecko, coinBase]);
    }

    findAvailableApi(token: string): BaseExchangeApi {
        const upperCaseToken = token?.toUpperCase();
        const availableApi = EXCHANGE_APIS.find((api) =>
            api.tokens.includes(upperCaseToken)
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
        const sourceApi = this.findAvailableApi(sourceCurrency);
        const targetApi = this.findAvailableApi(targetCurrency);

        const sourceTokenName = sourceApi.getApiTokenName(sourceCurrency);
        const targetTokenName = targetApi.getApiTokenName(targetCurrency);

        const intermediary = intermediateCurrency
            ? intermediateCurrency
            : INTERMEDIATE_CURRENCY;

        const [sourceExchangeRate, targetExchangeRate] = await Promise.all([
            sourceApi.queryExchangeRate(sourceTokenName, intermediary),
            targetApi.queryExchangeRate(targetTokenName, intermediary)
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
