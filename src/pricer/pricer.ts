import { BigNumber as BigNumberJs } from 'bignumber.js';
import log from 'loglevel';
import {
  ExchangeApiName,
  INTERMEDIATE_CURRENCY,
  tokenToApi,
  createExchangeApi,
} from './utils';

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
  if (sourceCurrency === targetCurrency) {
    return BigNumberJs(1);
  }

  const exchangeApis = tokenToApi[sourceCurrency.toUpperCase()];

  if (!exchangeApis) {
    throw Error(`Token ${sourceCurrency} does not have an API to query`);
  }

  log.debug(`${exchangeApis.toString()} found for token ${sourceCurrency}`);

  return queryExchangeApis(exchangeApis, sourceCurrency, targetCurrency);
};

const queryExchangeApis = async (
  exchangeApis: ExchangeApiName[],
  sourceCurrency: string,
  targetCurrency: string
): Promise<BigNumberJs> => {
  for (const api of exchangeApis) {
    const exchangeApi = createExchangeApi(api);

    const exchangeRate = await exchangeApi
      .queryExchangeRate(sourceCurrency, targetCurrency)
      .catch((e: unknown) => {
        log.debug(e);

        return undefined;
      });

    if (exchangeRate) {
      tokenToApi[sourceCurrency.toUpperCase()] = [
        ...new Set([api, ...exchangeApis]),
      ];

      return exchangeRate;
    }

    log.warn(
      `No exchange rate found for ${sourceCurrency}/${targetCurrency} using API ${api}`
    );
  }

  return BigNumberJs(0);
};

export { getExchangeRate, queryExchangeRate };
