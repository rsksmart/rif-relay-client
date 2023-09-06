import type { CurrencyMapping } from './BaseExchangeApi';
import { StableCoinExchange } from './StableCoinExchange';

const RDOC = 'RDOC';
const RDOC_EXCHANGE_NAME = 'RDocExchange';

const CURRENCY_MAPPING: CurrencyMapping = {
  RDOC,
};

export default class RdocExchange extends StableCoinExchange {
  constructor() {
    super(RDOC, RDOC_EXCHANGE_NAME, CURRENCY_MAPPING);
  }
}
