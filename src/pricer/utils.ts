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

const builders = new Map<ExchangeApiName, ExchangeApi>();
builders.set(
  'coinBase',
  new ExchangeApiCache(new CoinBase(), CACHE_EXPIRATION_TIME)
);
builders.set(
  'coinCodex',
  new ExchangeApiCache(new CoinCodex(), CACHE_EXPIRATION_TIME)
);
builders.set(
  'coinGecko',
  new ExchangeApiCache(new CoinGecko(), CACHE_EXPIRATION_TIME)
);
builders.set('rdocExchange', new RdocExchange());
builders.set('testExchange', new TestExchange());

export { tokenToApi, INTERMEDIATE_CURRENCY, builders as apiBuilder };

export type { ExchangeApiName };
