import type { BaseExchangeApi } from 'src/api';
import {
  CoinBase,
  CoinCodex,
  CoinGecko,
  RdocExchange,
  TestExchange,
} from '../api';

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

const INTERMEDIATE_CURRENCY = 'USD';

type CoinBaseConstructorArgs = ConstructorParameters<typeof CoinBase>;
type CoinCodexConstructorArgs = ConstructorParameters<typeof CoinCodex>;
type CoinGeckoConstructorArgs = ConstructorParameters<typeof CoinGecko>;
type ConstructorArgs =
  | CoinBaseConstructorArgs
  | CoinCodexConstructorArgs
  | CoinGeckoConstructorArgs;

const builders = new Map<
  ExchangeApiName,
  (args?: ConstructorArgs) => BaseExchangeApi
>();
builders.set(
  'coinBase',
  (args: CoinBaseConstructorArgs = []) => new CoinBase(...args)
);
builders.set(
  'coinCodex',
  (args: CoinCodexConstructorArgs = []) => new CoinCodex(...args)
);
builders.set(
  'coinGecko',
  (args: CoinGeckoConstructorArgs = []) => new CoinGecko(...args)
);
builders.set('rdocExchange', () => new RdocExchange());
builders.set('testExchange', () => new TestExchange());

function createExchangeApi(
  exchangeApiType: ExchangeApiName,
  args?: ConstructorArgs
): BaseExchangeApi {
  const fn = builders.get(exchangeApiType);
  if (!fn) throw new Error(`${exchangeApiType} is not mapped`);

  return fn(args);
}

export { tokenToApi, INTERMEDIATE_CURRENCY, createExchangeApi };

export type { ExchangeApiName };
