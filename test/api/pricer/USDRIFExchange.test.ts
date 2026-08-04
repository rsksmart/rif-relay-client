import { expect } from 'chai';
import USDRIFExchange from '../../../src/api/pricer/USDRIFExchange';

type USDRIFExchangeWithProtected = {
  _getCurrencyName(tokenSymbol: string): string;
};

describe('USDRIFExchange', function () {
  let usdrifExchange: USDRIFExchange;
  let usdrifExchangeWithProtected: USDRIFExchangeWithProtected;
  const SOURCE_CURRENCY = 'USDRIF';
  const TARGET_CURRENCY = 'USD';
  const X_RATE_USDRIF_USD = '1';

  beforeEach(function () {
    usdrifExchange = new USDRIFExchange();
    usdrifExchangeWithProtected =
      usdrifExchange as unknown as USDRIFExchangeWithProtected;
  });

  describe('_getCurrencyName', function () {
    it('should return mapped token name', function () {
      expect(
        usdrifExchangeWithProtected._getCurrencyName('USDRIF')
      ).to.be.equal(SOURCE_CURRENCY);
    });

    it('should return mapped token(lowercase) name', function () {
      expect(
        usdrifExchangeWithProtected._getCurrencyName('usdrif')
      ).to.be.equal(SOURCE_CURRENCY);
    });

    it('should return token if token is not mapped', function () {
      expect(usdrifExchangeWithProtected._getCurrencyName('btc')).to.be.equal(
        'btc'
      );
    });

    it('should fail if token symbol is empty', function () {
      expect(() => usdrifExchangeWithProtected._getCurrencyName('')).to.throw(
        'UsdRifExchange API cannot map a token with a null/empty value'
      );
    });
  });

  describe('queryExchangeRate', function () {
    it('should return exchange rate USDRIF/USD', async function () {
      const exchangeRate = await usdrifExchange.queryExchangeRate(
        SOURCE_CURRENCY,
        TARGET_CURRENCY
      );

      expect(exchangeRate.toString()).to.be.equal(X_RATE_USDRIF_USD);
    });

    it('should return exchange rate usdrif/usd', async function () {
      const exchangeRate = await usdrifExchange.queryExchangeRate(
        SOURCE_CURRENCY.toLowerCase(),
        TARGET_CURRENCY.toLowerCase()
      );

      expect(exchangeRate.toString()).to.be.equal(X_RATE_USDRIF_USD);
    });

    it('should fail if rate does not exist', function () {
      expect(() =>
        usdrifExchange.queryExchangeRate(SOURCE_CURRENCY, 'NA')
      ).to.Throw(
        `Exchange rate for currency pair ${SOURCE_CURRENCY} / NA is not available`
      );
    });
  });
});
