import {
  CoinBase,
  CoinCodex,
  CoinGecko,
  RdocExchange,
  TestExchange,
} from '../api';
import type { ExchangeApiName } from './utils';

class ExchangeApiFactory {
  static getExchangeApi(exchageApiType: ExchangeApiName) {
    switch (exchageApiType) {
      case 'coinBase':
        return new CoinBase();
      case 'coinGecko':
        return new CoinGecko();
      case 'coinCodex':
        return new CoinCodex();
      case 'rdocExchange':
        return new RdocExchange();
      case 'testExchange':
        return new TestExchange();
    }
  }
}

export { ExchangeApiFactory };
