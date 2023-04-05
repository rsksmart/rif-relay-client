import { expect } from 'chai';
import { SinonStubbedInstance, createStubInstance, restore } from 'sinon';
import { HttpWrapper } from '../../../src/api/common';

import CoinCodex, {
  CoinCodexResponse,
} from '../../../src/api/pricer/CoinCodex';

describe('CoinCodex', function () {
  type CoinCodexExposed = {
    _getCurrencyName(tokenSymbol: string): string;
  } & {
    [key in keyof CoinCodex]: CoinCodex[key];
  };
  let coinCodex: CoinCodexExposed;
  const sourceCurrency = 'RIF';
  const targetCurrency = 'USD';
  const xRateRifUsd = '0.07770028890144696';

  beforeEach(function () {
    coinCodex = new CoinCodex() as unknown as CoinCodexExposed;
  });

  describe('_getCurrencyName', function () {
    it('should return mapped token name', function () {
      expect(coinCodex._getCurrencyName('RIF')).to.be.equal(sourceCurrency);
    });

    it('should return mapped token(lowercase) name', function () {
      expect(coinCodex._getCurrencyName('rif')).to.be.equal(sourceCurrency);
    });

    it('should return token if token is not mapped', function () {
      expect(coinCodex._getCurrencyName('btc')).to.be.equal('btc');
    });

    it('should fail if token symbol is empty', function () {
      expect(() => coinCodex._getCurrencyName('')).to.throw(
        'CoinCodex API cannot map a token with a null/empty value'
      );
    });
  });

  describe('queryExchangeRate', function () {
    let httpWrapperStub: SinonStubbedInstance<HttpWrapper>;
    const coinCodexResponse: CoinCodexResponse = {
      last_price_usd: xRateRifUsd,
    };

    beforeEach(function () {
      httpWrapperStub = createStubInstance(HttpWrapper, {
        sendPromise: Promise.resolve(coinCodexResponse),
      });
      (coinCodex as unknown as { _httpWrapper: HttpWrapper })._httpWrapper =
        httpWrapperStub;
    });

    afterEach(function () {
      restore();
    });

    it('should return exchange rate RIF/USD', async function () {
      const exchangeRate = await coinCodex.queryExchangeRate(
        sourceCurrency,
        targetCurrency
      );

      expect(exchangeRate.toString()).to.be.equal(
        xRateRifUsd,
        'Exchange rate is no the same'
      );
    });

    it('should return exchange rate rif/usd', async function () {
      const exchangeRate = await coinCodex.queryExchangeRate(
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
        coinCodex.queryExchangeRate(sourceCurrency, 'NA')
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
        coinCodex.queryExchangeRate('NA', targetCurrency)
      ).to.be.rejectedWith(`CoinCodex API status ${expectedStatus}`);
    });

    it("should fail if API doesn't return a response", async function () {
      const fakeError = {};
      httpWrapperStub.sendPromise.rejects(fakeError);

      await expect(
        coinCodex.queryExchangeRate('NA', targetCurrency)
      ).to.be.rejectedWith('No response received from CoinCodex API');
    });
  });
});
