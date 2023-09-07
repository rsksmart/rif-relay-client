import { expect } from 'chai';
import USDRIFExchange from '../../../src/api/pricer/USDRIFExchange';

describe('USDRIFExchange', function () {
  type USDRIFExchangeExposed = {
    _getCurrencyName(tokenSymbol: string): string;
  } & {
    [key in keyof USDRIFExchange]: USDRIFExchange[key];
  };
  let rdocExchange: USDRIFExchangeExposed;
  const SOURCE_CURRENCY = 'USDRIF';
  const TARGET_CURRENCY = 'USD';
  const X_RATE_USDRIF_USD = '1';

  beforeEach(function () {
    rdocExchange = new USDRIFExchange() as unknown as USDRIFExchangeExposed;
  });

  describe('_getCurrencyName', function () {
    it('should return mapped token name', function () {
      expect(rdocExchange._getCurrencyName('USDRIF')).to.be.equal(
        SOURCE_CURRENCY
      );
    });

    it('should return mapped token(lowercase) name', function () {
      expect(rdocExchange._getCurrencyName('usdrif')).to.be.equal(
        SOURCE_CURRENCY
      );
    });

    it('should return token if token is not mapped', function () {
      expect(rdocExchange._getCurrencyName('btc')).to.be.equal('btc');
    });

    it('should fail if token symbol is empty', function () {
      expect(() => rdocExchange._getCurrencyName('')).to.throw(
        'UsdRifExchange API cannot map a token with a null/empty value'
      );
    });
  });

  describe('queryExchangeRate', function () {
    it('should return exchange rate USDRIF/USD', async function () {
      const exchangeRate = await rdocExchange.queryExchangeRate(
        SOURCE_CURRENCY,
        TARGET_CURRENCY
      );

      expect(exchangeRate.toString()).to.be.equal(X_RATE_USDRIF_USD);
    });

    it('should return exchange rate usdrif/usd', async function () {
      const exchangeRate = await rdocExchange.queryExchangeRate(
        SOURCE_CURRENCY.toLowerCase(),
        TARGET_CURRENCY.toLowerCase()
      );

      expect(exchangeRate.toString()).to.be.equal(X_RATE_USDRIF_USD);
    });

    it('should fail if rate does not exist', function () {
      expect(() =>
        rdocExchange.queryExchangeRate(SOURCE_CURRENCY, 'NA')
      ).to.Throw(
        `Exchange rate for currency pair ${SOURCE_CURRENCY} / NA is not available`
      );
    });
  });
});
