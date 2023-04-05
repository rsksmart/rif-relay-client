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

export { tokenToApi, INTERMEDIATE_CURRENCY };

export type { ExchangeApiName };
