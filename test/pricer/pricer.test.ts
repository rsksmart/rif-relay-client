import { expect } from 'chai';
import {
  restore,
  stub,
  SinonStubbedInstance,
  createStubInstance,
  SinonStub,
} from 'sinon';
import { BigNumber as BigNumberJs } from 'bignumber.js';
import { getExchangeRate } from '../../src/pricer/pricer';
import { tokenToApi } from '../../src/pricer/utils';
import { ExchangeApiFactory } from '../../src/pricer/ExchangeApiFactory';
import { BaseExchangeApi, CoinCodex, CoinGecko } from '../../src/api';
import { INTERMEDIATE_CURRENCY } from '../../src/pricer/utils';

describe('pricer', function () {
  describe('getExchangeRate', function () {
    let coinGeckoStub: SinonStubbedInstance<CoinGecko>;
    let fakeRifUsd: BigNumberJs;
    let fakeRbtcUsd: BigNumberJs;
    let fakeRbtcRif: BigNumberJs;
    let fakeRifRbtc: BigNumberJs;
    const RIF_SYMBOL = 'RIF';
    const RBTC_SYMBOL = 'RBTC';
    let exchangeApiFactoryStub: SinonStub;

    beforeEach(function () {
      coinGeckoStub = createStubInstance(CoinGecko);
      fakeRifUsd = randomBigNumberJs(25000);
      fakeRbtcUsd = randomBigNumberJs(25000);
      fakeRbtcRif = fakeRbtcUsd.dividedBy(fakeRifUsd);
      fakeRifRbtc = fakeRifUsd.dividedBy(fakeRbtcUsd);
      exchangeApiFactoryStub = stub(ExchangeApiFactory, 'getExchangeApi')
        .withArgs('coinGecko')
        .returns(coinGeckoStub);
      stubExchangeRate(
        coinGeckoStub,
        RIF_SYMBOL,
        INTERMEDIATE_CURRENCY,
        fakeRifUsd
      );
      stubExchangeRate(
        coinGeckoStub,
        RBTC_SYMBOL,
        INTERMEDIATE_CURRENCY,
        fakeRbtcUsd
      );
    });

    afterEach(function () {
      restore();
    });

    function randomBigNumberJs(max: number) {
      return BigNumberJs(Math.random() * max);
    }

    function stubExchangeRate(
      exchangeApi: SinonStubbedInstance<BaseExchangeApi>,
      sourceCurrency: string,
      targetCurrency: string,
      exchangeRate: BigNumberJs
    ) {
      exchangeApi.queryExchangeRate
        .withArgs(sourceCurrency, targetCurrency)
        .returns(Promise.resolve(exchangeRate));
    }

    it('should return exchange rate', async function () {
      const exchangeRate = await getExchangeRate(RIF_SYMBOL, RBTC_SYMBOL);

      expect(exchangeRate.toString()).to.be.equal(fakeRifRbtc.toString());
    });

    it('should return exchange rate if currencies are in lower case', async function () {
      const rifSymbol = RIF_SYMBOL.toLowerCase();
      const rbtcSymbol = RBTC_SYMBOL.toLowerCase();
      stubExchangeRate(
        coinGeckoStub,
        rifSymbol,
        INTERMEDIATE_CURRENCY,
        fakeRifUsd
      );
      stubExchangeRate(
        coinGeckoStub,
        rbtcSymbol,
        INTERMEDIATE_CURRENCY,
        fakeRbtcUsd
      );
      const exchangeRate = await getExchangeRate(rifSymbol, rbtcSymbol);

      expect(exchangeRate.toString()).to.be.equal(fakeRifRbtc.toString());
    });

    it('should return the reverse exchange rate', async function () {
      const exchangeRate = await getExchangeRate(RBTC_SYMBOL, RIF_SYMBOL);

      expect(exchangeRate.toString()).to.be.equal(fakeRbtcRif.toString());
    });

    it('should return exchange rate and update prioritization', async function () {
      const coinCodexStub = createStubInstance(CoinCodex);
      stubExchangeRate(
        coinCodexStub,
        RBTC_SYMBOL,
        INTERMEDIATE_CURRENCY,
        fakeRbtcUsd
      );
      exchangeApiFactoryStub.withArgs('coinCodex').returns(coinCodexStub);
      coinGeckoStub.queryExchangeRate
        .withArgs(RBTC_SYMBOL, INTERMEDIATE_CURRENCY)
        .rejects();

      const beforeTokenToApi = tokenToApi[RBTC_SYMBOL];
      const exchangeRate = await getExchangeRate(RIF_SYMBOL, RBTC_SYMBOL);
      const afterTokenToApi = tokenToApi[RBTC_SYMBOL];

      expect(exchangeRate.toString()).to.be.equal(fakeRifRbtc.toString());
      expect(beforeTokenToApi?.at(0)).to.be.equal('coinGecko');
      expect(afterTokenToApi?.at(0)).to.be.equal('coinCodex');
    });

    it('should fail if token does not have an API mapped', async function () {
      await expect(getExchangeRate(RIF_SYMBOL, 'NA')).to.be.rejectedWith(
        'Token NA does not have an API to query'
      );
    });

    it("should fail if all the mapped API's fail", async function () {
      const coinCodexStub = createStubInstance(CoinCodex);
      exchangeApiFactoryStub.withArgs('coinCodex').returns(coinCodexStub);
      coinGeckoStub.queryExchangeRate
        .withArgs(RBTC_SYMBOL, INTERMEDIATE_CURRENCY)
        .rejects();
      coinCodexStub.queryExchangeRate
        .withArgs(RBTC_SYMBOL, INTERMEDIATE_CURRENCY)
        .rejects();

      await expect(getExchangeRate(RIF_SYMBOL, RBTC_SYMBOL)).to.be.rejectedWith(
        `Currency conversion for pair ${RIF_SYMBOL}:${RBTC_SYMBOL} not found in current exchange api`
      );
    });

    it('should fail if intermediate currency is not valid', async function () {
      await expect(
        getExchangeRate(RIF_SYMBOL, RBTC_SYMBOL, 'NA')
      ).to.be.rejectedWith(
        `Currency conversion for pair ${RIF_SYMBOL}:${RBTC_SYMBOL} not found in current exchange api`
      );
    });
  });
});
