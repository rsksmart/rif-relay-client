import { CachedExchangeApi } from '../api/pricer/CachedExchangeApi';
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
builders.set('coinBase', new CoinBase());
builders.set('coinCodex', new CoinCodex());
builders.set(
  'coinGecko',
  new CachedExchangeApi(new CoinGecko(), CACHE_EXPIRATION_TIME)
);
builders.set('rdocExchange', new RdocExchange());
builders.set('testExchange', new TestExchange());

export { tokenToApi, INTERMEDIATE_CURRENCY, builders as apiBuilder };

export type { ExchangeApiName };
