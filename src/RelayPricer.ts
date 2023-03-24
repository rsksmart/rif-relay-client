import type { BigNumber as BigNumberJs } from 'bignumber.js';
import {
  BaseExchangeApi,
  RdocExchange,
  TestExchange,
  CoinGecko,
  CoinBase,
} from './api/pricer';
import log from 'loglevel';

const INTERMEDIATE_CURRENCY = 'USD';

const testExchange = new TestExchange();
const rdocExchange = new RdocExchange();
const coinGecko = new CoinGecko();
const coinbase = new CoinBase();

// TODO: We may want to change the selection strategy
const EXCHANGE_APIS: BaseExchangeApi[] = [
  coinbase,
  coinGecko,
  testExchange,
  rdocExchange,
];

export default class RelayPricer {
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
  ): Promise<BigNumberJs> {
    const sourceApi = this.findAvailableApi(sourceCurrency);
    const targetApi = this.findAvailableApi(targetCurrency);
    log.debug('RelayPricer APIs selected', sourceApi, targetApi);

    const sourceTokenName = sourceApi.getApiTokenName(sourceCurrency);
    const targetTokenName = targetApi.getApiTokenName(targetCurrency);

    const intermediary = intermediateCurrency
      ? intermediateCurrency
      : INTERMEDIATE_CURRENCY;

    log.debug('RelayPricer: intermediary Currency', intermediary);
    const [sourceExchangeRate, targetExchangeRate] = await Promise.all([
      sourceApi.queryExchangeRate(sourceTokenName, intermediary),
      targetApi.queryExchangeRate(targetTokenName, intermediary),
    ]);

    if (sourceExchangeRate.isEqualTo(0) || targetExchangeRate.isEqualTo(0)) {
      const message = `Currency conversion for pair ${sourceCurrency}:${targetCurrency} not found in current exchange api`;
      log.error(`RelayPricer exchange rates: ${message}`);
      throw Error(message);
    }
    log.debug(
      'RelayPricer exchange rates:',
      sourceExchangeRate.toString(),
      targetExchangeRate.toString()
    );

    return sourceExchangeRate.dividedBy(targetExchangeRate);
  }
}
