import { BigNumber as BigNumberJs } from 'bignumber.js';
import log from 'loglevel';
import { ExchangeApiName, INTERMEDIATE_CURRENCY, tokenToApi } from './utils';
import { ExchangeApiFactory } from './ExchangeApiFactory';
import type { BaseExchangeApi } from '../api';

const getExchangeRate = async (
  sourceCurrency: string,
  targetCurrency: string,
  intermediateCurrency = INTERMEDIATE_CURRENCY
) => {
  log.debug('RelayPricer: intermediary Currency', intermediateCurrency);

  const sourceExchangeRate = await queryExchangeRate(
    sourceCurrency,
    intermediateCurrency
  );

  const targetExchangeRate = await queryExchangeRate(
    targetCurrency,
    intermediateCurrency
  );

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
};

const queryExchangeRate = async (
  sourceCurrency: string,
  targetCurrency: string
): Promise<BigNumberJs> => {
  const exchangeApis = tokenToApi[sourceCurrency.toUpperCase()];

  if (!exchangeApis) {
    throw Error(`Token ${sourceCurrency} does not have an API to query`);
  }

  log.debug(`${exchangeApis.toString()} found for token ${sourceCurrency}`);

  return queryExchangeApis(exchangeApis, sourceCurrency, targetCurrency);
};

const queryExchangeApis = async (
  exchangesApi: ExchangeApiName[],
  sourceCurrency: string,
  targetCurrency: string
): Promise<BigNumberJs> => {
  for (const api of exchangesApi) {
    const exchangeApi = ExchangeApiFactory.getExchangeApi(api);

    const exchangeRate = await queryExchangeApi(
      exchangeApi,
      sourceCurrency,
      targetCurrency
    );

    if (exchangeRate) {
      tokenToApi[sourceCurrency.toUpperCase()] = [
        ...new Set([api, ...exchangesApi]),
      ];

      return exchangeRate;
    }
  }

  return BigNumberJs(0);
};

const queryExchangeApi = async (
  exchangeApi: BaseExchangeApi,
  sourceCurrency: string,
  targetCurrency: string
): Promise<BigNumberJs | undefined> => {
  try {
    return await exchangeApi.queryExchangeRate(sourceCurrency, targetCurrency);
  } catch (e: unknown) {
    log.error(e);

    return undefined;
  }
};

export { getExchangeRate };
