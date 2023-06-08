import { ExchangeApiCache } from '../api/pricer/ExchangeApiCache';
import {
  CoinBase,
  CoinCodex,
  CoinGecko,
  RdocExchange,
  TestExchange,
} from '../api';
import type { ExchangeApi } from 'src/api/pricer/BaseExchangeApi';

type ExchangeApiName =
  | 'coinBase'
  | 'coinGecko'
  | 'coinCodex'
  | 'rdocExchange'
  | 'testExchange';

const tokenToApi: Record<string, ExchangeApiName[]> = {
  RBTC: ['coinGecko', 'coinCodex'],
  RDOC: ['rdocExchange'],
  RIF: ['coinGecko', 'coinBase', 'coinCodex'],
  TRIF: ['coinGecko', 'coinBase', 'coinCodex'],
  TKN: ['testExchange'],
};

const CACHE_EXPIRATION_TIME = 60_000;
const INTERMEDIATE_CURRENCY = 'USD';

const exchanges = new Map<ExchangeApiName, ExchangeApi>();
exchanges.set(
  'coinBase',
  new ExchangeApiCache(new CoinBase(), CACHE_EXPIRATION_TIME)
);
exchanges.set(
  'coinCodex',
  new ExchangeApiCache(new CoinCodex(), CACHE_EXPIRATION_TIME)
);
exchanges.set(
  'coinGecko',
  new ExchangeApiCache(new CoinGecko(), CACHE_EXPIRATION_TIME)
);
exchanges.set('rdocExchange', new RdocExchange());
exchanges.set('testExchange', new TestExchange());

export { tokenToApi, INTERMEDIATE_CURRENCY, exchanges };

export type { ExchangeApiName };
