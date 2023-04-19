import { expect } from 'chai';
import RdocExchange from '../../../src/api/pricer/RdocExchange';

describe('RdocExchange', function () {
  type RdocExchangeExposed = {
    _getCurrencyName(tokenSymbol: string): string;
  } & {
    [key in keyof RdocExchange]: RdocExchange[key];
  };
  let rdocExchange: RdocExchangeExposed;
  const SOURCE_CURRENCY = 'RDOC';
  const TARGET_CURRENCY = 'USD';
  const X_RATE_RDOC_USD = '1';

  beforeEach(function () {
    rdocExchange = new RdocExchange() as unknown as RdocExchangeExposed;
  });

  describe('_getCurrencyName', function () {
    it('should return mapped token name', function () {
      expect(rdocExchange._getCurrencyName('RDOC')).to.be.equal(
        SOURCE_CURRENCY
      );
    });

    it('should return mapped token(lowercase) name', function () {
      expect(rdocExchange._getCurrencyName('rdoc')).to.be.equal(
        SOURCE_CURRENCY
      );
    });

    it('should return token if token is not mapped', function () {
      expect(rdocExchange._getCurrencyName('btc')).to.be.equal('btc');
    });

    it('should fail if token symbol is empty', function () {
      expect(() => rdocExchange._getCurrencyName('')).to.throw(
        'RdocExchange API cannot map a token with a null/empty value'
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
