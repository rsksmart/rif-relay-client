import type { CurrencyMapping } from './BaseExchangeApi';
import { StableCoinExchange } from './StableCoinExchange';

const USDRIF = 'USDRIF';
const USDRIF_EXCHANGE_NAME = 'UsdRifExchange';

const CURRENCY_MAPPING: CurrencyMapping = {
  USDRIF,
};

export default class UsdRifExchange extends StableCoinExchange {
  constructor() {
    super(USDRIF, USDRIF_EXCHANGE_NAME, CURRENCY_MAPPING);
  }
}
