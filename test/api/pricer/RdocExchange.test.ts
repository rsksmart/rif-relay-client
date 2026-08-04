import { expect } from 'chai';
import RdocExchange from '../../../src/api/pricer/RdocExchange';

type RdocExchangeWithProtected = {
  _getCurrencyName(tokenSymbol: string): string;
};

describe('RdocExchange', function () {
  let rdocExchange: RdocExchange;
  let rdocExchangeWithProtected: RdocExchangeWithProtected;
  const SOURCE_CURRENCY = 'RDOC';
  const TARGET_CURRENCY = 'USD';
  const X_RATE_RDOC_USD = '1';

  beforeEach(function () {
    rdocExchange = new RdocExchange();
    rdocExchangeWithProtected =
      rdocExchange as unknown as RdocExchangeWithProtected;
  });

  describe('_getCurrencyName', function () {
    it('should return mapped token name', function () {
      expect(rdocExchangeWithProtected._getCurrencyName('RDOC')).to.be.equal(
        SOURCE_CURRENCY
      );
    });

    it('should return mapped token(lowercase) name', function () {
      expect(rdocExchangeWithProtected._getCurrencyName('rdoc')).to.be.equal(
        SOURCE_CURRENCY
      );
    });

    it('should return token if token is not mapped', function () {
      expect(rdocExchangeWithProtected._getCurrencyName('btc')).to.be.equal(
        'btc'
      );
    });

    it('should fail if token symbol is empty', function () {
      expect(() => rdocExchangeWithProtected._getCurrencyName('')).to.throw(
        'RDocExchange API cannot map a token with a null/empty value'
      );
    });
  });

  describe('queryExchangeRate', function () {
    it('should return exchange rate RDOC/USD', async function () {
      const exchangeRate = await rdocExchange.queryExchangeRate(
        SOURCE_CURRENCY,
        TARGET_CURRENCY
      );

      expect(exchangeRate.toString()).to.be.equal(X_RATE_RDOC_USD);
    });

    it('should return exchange rate rdoc/usd', async function () {
      const exchangeRate = await rdocExchange.queryExchangeRate(
        SOURCE_CURRENCY.toLowerCase(),
        TARGET_CURRENCY.toLowerCase()
      );

      expect(exchangeRate.toString()).to.be.equal(X_RATE_RDOC_USD);
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
