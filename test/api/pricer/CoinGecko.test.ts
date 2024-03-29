import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { SinonStubbedInstance, createStubInstance, restore } from 'sinon';
import { HttpWrapper } from '../../../src/api/common';

import CoinGecko, {
  CoinGeckoResponse,
  COINGECKO_RBTC_ID,
  COINGECKO_RIF_TOKEN_ID,
} from '../../../src/api/pricer/CoinGecko';

use(chaiAsPromised);

describe('CoinGecko', function () {
  type CoinGeckoExposed = {
    _getCurrencyName(tokenSymbol: string): string;
  } & {
    [key in keyof CoinGecko]: CoinGecko[key];
  };
  let coinGecko: CoinGeckoExposed;
  const targetCurrency = 'USD';
  const xRateRifUsd = '0.07770028890144696';

  beforeEach(function () {
    coinGecko = new CoinGecko() as unknown as CoinGeckoExposed;
  });

  describe('_getCurrencyName', function () {
    describe('using RIF', function () {
      it('should return mapped token name', function () {
        expect(coinGecko._getCurrencyName('RIF')).to.be.equal(
          COINGECKO_RIF_TOKEN_ID
        );
      });

      it('should return mapped token(lowercase) name', function () {
        expect(coinGecko._getCurrencyName('rif')).to.be.equal(
          COINGECKO_RIF_TOKEN_ID
        );
      });
    });

    describe('using RBTC', function () {
      it('should return mapped token name', function () {
        expect(coinGecko._getCurrencyName('RBTC')).to.be.equal(
          COINGECKO_RBTC_ID
        );
      });

      it('should return mapped token(lowercase) name', function () {
        expect(coinGecko._getCurrencyName('rbtc')).to.be.equal(
          COINGECKO_RBTC_ID
        );
      });
    });

    it('should return token if token is not mapped', function () {
      expect(coinGecko._getCurrencyName('btc')).to.be.equal('btc');
    });

    it('should fail if token symbol is empty', function () {
      expect(() => coinGecko._getCurrencyName('')).to.throw(
        'CoinGecko API cannot map a token with a null/empty value'
      );
    });
  });

  describe('queryExchangeRate', function () {
    let httpWrapperStub: SinonStubbedInstance<HttpWrapper>;

    beforeEach(function () {
      httpWrapperStub = createStubInstance(HttpWrapper, {
        sendPromise: Promise.resolve({}),
      });
      (coinGecko as unknown as { _httpWrapper: HttpWrapper })._httpWrapper =
        httpWrapperStub;
    });

    afterEach(function () {
      restore();
    });

    function stubHttpWrapperWithResponse(coinGeckoResponse: CoinGeckoResponse) {
      httpWrapperStub.sendPromise.resolves(coinGeckoResponse);
    }

    function stubHttpWrapperWithError(error: unknown) {
      httpWrapperStub.sendPromise.rejects(error);
    }

    const testQueryExchangeRate = (sourceCurrency: string) =>
      async function () {
        const coinGeckoResponse: CoinGeckoResponse = {
          [sourceCurrency]: {
            usd: xRateRifUsd,
          },
        };
        stubHttpWrapperWithResponse(coinGeckoResponse);

        const exchangeRate = await coinGecko.queryExchangeRate(
          sourceCurrency,
          targetCurrency
        );

        expect(exchangeRate.toString()).to.be.equal(xRateRifUsd);
      };

    const testQueryExchangeRateLowerCase = (sourceCurrency: string) =>
      async function () {
        const coinGeckoResponse: CoinGeckoResponse = {
          [sourceCurrency]: {
            usd: xRateRifUsd,
          },
        };
        stubHttpWrapperWithResponse(coinGeckoResponse);
        const exchangeRate = await coinGecko.queryExchangeRate(
          sourceCurrency.toLowerCase(),
          targetCurrency.toLowerCase()
        );

        expect(exchangeRate.toString()).to.be.equal(xRateRifUsd);
      };

    const testNoTargetCurrency = (sourceCurrency: string) =>
      async function () {
        const targetCurrency = 'NA';

        await expect(
          coinGecko.queryExchangeRate(sourceCurrency, targetCurrency)
        ).to.be.rejectedWith(
          `Exchange rate for currency pair ${sourceCurrency}/${targetCurrency} is not available`
        );
      };

    describe('using RIF as sourceCurrency', function () {
      it(
        'should return exchange rate RIF/USD',
        testQueryExchangeRate(COINGECKO_RIF_TOKEN_ID)
      );

      it(
        'should return exchange rate rif/usd',
        testQueryExchangeRateLowerCase(COINGECKO_RIF_TOKEN_ID)
      );

      it(
        'should fail if target currency does not exist',
        testNoTargetCurrency(COINGECKO_RIF_TOKEN_ID)
      );
    });

    describe('using RBTC as sourceCurrency', function () {
      it(
        'should return exchange rate RBTC/USD',
        testQueryExchangeRate(COINGECKO_RBTC_ID)
      );

      it(
        'should return exchange rate rbtc/usd',
        testQueryExchangeRateLowerCase(COINGECKO_RBTC_ID)
      );

      it(
        'should fail if target currency does not exist',
        testNoTargetCurrency(COINGECKO_RBTC_ID)
      );
    });

    it('should fail if API returns handled error message', async function () {
      const expectedStatus = 400;
      const fakeError = {
        response: {
          status: expectedStatus,
        },
      };
      stubHttpWrapperWithError(fakeError);

      await expect(
        coinGecko.queryExchangeRate('NA', targetCurrency)
      ).to.eventually.be.rejectedWith(`CoinGecko API status ${expectedStatus}`);
    });

    it("should fail if API doesn't return a response", async function () {
      stubHttpWrapperWithError({});

      await expect(
        coinGecko.queryExchangeRate('NA', targetCurrency)
      ).to.eventually.be.rejectedWith(
        'No response received from CoinGecko API'
      );
    });
  });
});
