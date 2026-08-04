import { expect } from 'chai';
import { SinonStubbedInstance, createStubInstance, restore } from 'sinon';
import { HttpWrapper } from '../../../src/api/common';

import CoinBase, { CoinBaseResponse } from '../../../src/api/pricer/CoinBase';

type CoinBaseWithProtected = {
  _getCurrencyName(tokenSymbol: string): string;
};

describe('CoinBase', function () {
  let coinBase: CoinBase;
  let coinBaseWithProtected: CoinBaseWithProtected;
  const sourceCurrency = 'RIF';
  const targetCurrency = 'USD';
  const xRateRifUsd = '0.07770028890144696';

  beforeEach(function () {
    coinBase = new CoinBase();
    coinBaseWithProtected = coinBase as unknown as CoinBaseWithProtected;
  });

  describe('_getCurrencyName', function () {
    it('should return mapped token name', function () {
      expect(coinBaseWithProtected._getCurrencyName('RIF')).to.be.equal(
        sourceCurrency
      );
    });

    it('should return mapped token(lowercase) name', function () {
      expect(coinBaseWithProtected._getCurrencyName('rif')).to.be.equal(
        sourceCurrency
      );
    });

    it('should return token if token is not mapped', function () {
      expect(coinBaseWithProtected._getCurrencyName('btc')).to.be.equal('btc');
    });

    it('should fail if token symbol is empty', function () {
      expect(() => coinBaseWithProtected._getCurrencyName('')).to.throw(
        'CoinBase API cannot map a token with a null/empty value'
      );
    });
  });

  describe('queryExchangeRate', function () {
    let httpWrapperStub: SinonStubbedInstance<HttpWrapper>;
    const coinBaseResponse: CoinBaseResponse = {
      data: {
        currency: sourceCurrency,
        rates: {
          USD: xRateRifUsd,
        },
      },
    };

    beforeEach(function () {
      httpWrapperStub = createStubInstance(HttpWrapper, {
        sendPromise: Promise.resolve(coinBaseResponse),
      });
      (coinBase as unknown as { _httpWrapper: HttpWrapper })._httpWrapper =
        httpWrapperStub;
    });

    afterEach(function () {
      restore();
    });

    it('should return exchange rate RIF/USD', async function () {
      const exchangeRate = await coinBase.queryExchangeRate(
        sourceCurrency,
        targetCurrency
      );

      expect(exchangeRate.toString()).to.be.equal(
        xRateRifUsd,
        'Exchange rate is no the same'
      );
    });

    it('should return exchange rate rif/usd', async function () {
      const exchangeRate = await coinBase.queryExchangeRate(
        sourceCurrency.toLowerCase(),
        targetCurrency.toLowerCase()
      );

      expect(exchangeRate.toString()).to.be.equal(
        xRateRifUsd,
        'Exchange rate is no the same'
      );
    });

    it('should fail if rate does not exist', async function () {
      await expect(
        coinBase.queryExchangeRate(sourceCurrency, 'NA')
      ).to.be.rejectedWith(
        `Exchange rate for currency pair ${sourceCurrency}/NA is not available`
      );
    });

    it('should fail if API returns handled error message', async function () {
      const expectedStatus = 400;
      const fakeError = {
        response: {
          status: expectedStatus,
        },
      };
      httpWrapperStub.sendPromise.rejects(fakeError);

      await expect(
        coinBase.queryExchangeRate('NA', targetCurrency)
      ).to.be.rejectedWith(`CoinBase API status ${expectedStatus}`);
    });

    it("should fail if API doesn't return a response", async function () {
      const fakeError = {};
      httpWrapperStub.sendPromise.rejects(fakeError);

      await expect(
        coinBase.queryExchangeRate('NA', targetCurrency)
      ).to.be.rejectedWith('No response received from CoinBase API');
    });
  });
});
