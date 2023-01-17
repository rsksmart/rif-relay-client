import { use, assert, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import RdocExchange from '../../../src/api/pricer/RdocExchange';

use(chaiAsPromised);

describe('RdocExchange', function () {
  let rdocExchange: RdocExchange;
  const SOURCE_CURRENCY = 'RDOC';
  const TARGET_CURRENCY = 'USD';
  const X_RATE_RDOC_USD = '1';

  beforeEach(function () {
    rdocExchange = new RdocExchange();
  });

  describe('getApiTokenName', function () {
    it('should return mapped token name', function () {
      assert.equal(rdocExchange.getApiTokenName('RDOC'), SOURCE_CURRENCY);
    });

    it('should return mapped token(lowercase) name', function () {
      assert.equal(rdocExchange.getApiTokenName('rdoc'), SOURCE_CURRENCY);
    });

    it('should fail if token symbol is not mapped', function () {
      expect(() => rdocExchange.getApiTokenName('btc')).to.throw(
        'Token BTC is not internally mapped in RdocExchange API'
      );
    });

    it('should fail if token symbol is empty', function () {
      expect(() => rdocExchange.getApiTokenName('')).to.throw(
        'RdocExchange API cannot map a token with a null/empty value'
      );
    });
  });

  describe('queryExchangeRate', function () {
    it('Should return exchange rate RDOC/USD', function () {
      expect(
        rdocExchange
          .queryExchangeRate(SOURCE_CURRENCY, TARGET_CURRENCY)
          .toString()
      ).to.be.equal(X_RATE_RDOC_USD);
    });

    it('Should return exchange rate rdoc/usd', function () {
      expect(
        rdocExchange
          .queryExchangeRate(
            SOURCE_CURRENCY.toLowerCase(),
            TARGET_CURRENCY.toLowerCase()
          )
          .toString()
      ).to.be.equal(X_RATE_RDOC_USD);
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
