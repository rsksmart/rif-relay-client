import { expect } from 'chai';
import {
  restore,
  SinonStubbedInstance,
  createStubInstance,
  spy,
  replace,
} from 'sinon';
import { BigNumber as BigNumberJs } from 'bignumber.js';
import { getExchangeRate } from '../../src/pricer/pricer';
import {
  BaseExchangeApi,
  CoinCodex,
  CoinGecko,
  RdocExchange,
  TestExchange,
} from '../../src/api';
import * as pricerUtils from '../../src/pricer/utils';
import type { ConstructorArgs, ExchangeApiName } from '../../src/pricer/utils';

describe('pricer', function () {
  describe('getExchangeRate', function () {
    let coinGeckoStub: SinonStubbedInstance<CoinGecko>;
    let fakeRifUsd: BigNumberJs;
    let fakeRbtcUsd: BigNumberJs;
    let fakeRbtcRif: BigNumberJs;
    let fakeRifRbtc: BigNumberJs;
    const RIF_SYMBOL = 'RIF';
    const RBTC_SYMBOL = 'RBTC';
    let fakeBuilder: Map<
      ExchangeApiName,
      (args?: ConstructorArgs) => BaseExchangeApi
    >;

    beforeEach(function () {
      coinGeckoStub = createStubInstance(CoinGecko);
      fakeRifUsd = randomBigNumberJs(25000);
      fakeRbtcUsd = randomBigNumberJs(25000);
      fakeRbtcRif = fakeRbtcUsd.dividedBy(fakeRifUsd);
      fakeRifRbtc = fakeRifUsd.dividedBy(fakeRbtcUsd);
      fakeBuilder = new Map();
      fakeBuilder.set('coinGecko', () => coinGeckoStub);
      replace(pricerUtils, 'apiBuilder', fakeBuilder);
      coinGeckoStub.queryExchangeRate
        .withArgs(RIF_SYMBOL, pricerUtils.INTERMEDIATE_CURRENCY)
        .resolves(fakeRifUsd);
      coinGeckoStub.queryExchangeRate
        .withArgs(RBTC_SYMBOL, pricerUtils.INTERMEDIATE_CURRENCY)
        .resolves(fakeRbtcUsd);
    });

    afterEach(function () {
      restore();
    });

    function randomBigNumberJs(max: number) {
      return BigNumberJs(Math.random() * max);
    }

    it('should return exchange rate', async function () {
      const exchangeRate = await getExchangeRate(RIF_SYMBOL, RBTC_SYMBOL);

      expect(exchangeRate.toString()).to.be.equal(fakeRifRbtc.toString());
    });

    it('should return exchange rate if currency is fiat', async function () {
      const exchangeRate = await getExchangeRate(RIF_SYMBOL, 'USD');

      expect(exchangeRate.toString()).to.be.equal(fakeRifUsd.toString());
    });

    it('should return exchange rate if currencies are in lower case', async function () {
      const rifSymbol = RIF_SYMBOL.toLowerCase();
      const rbtcSymbol = RBTC_SYMBOL.toLowerCase();
      coinGeckoStub.queryExchangeRate
        .withArgs(rifSymbol, pricerUtils.INTERMEDIATE_CURRENCY)
        .resolves(fakeRifUsd);
      coinGeckoStub.queryExchangeRate
        .withArgs(rbtcSymbol, pricerUtils.INTERMEDIATE_CURRENCY)
        .resolves(fakeRbtcUsd);
      const exchangeRate = await getExchangeRate(rifSymbol, rbtcSymbol);

      expect(exchangeRate.toString()).to.be.equal(fakeRifRbtc.toString());
    });

    it('should return the reverse exchange rate', async function () {
      const exchangeRate = await getExchangeRate(RBTC_SYMBOL, RIF_SYMBOL);

      expect(exchangeRate.toString()).to.be.equal(fakeRbtcRif.toString());
    });

    it('should return exchange rate and update prioritization', async function () {
      const coinCodexStub = createStubInstance(CoinCodex);
      coinCodexStub.queryExchangeRate
        .withArgs(RBTC_SYMBOL, pricerUtils.INTERMEDIATE_CURRENCY)
        .resolves(fakeRbtcUsd);
      fakeBuilder.set('coinCodex', () => coinCodexStub);
      coinGeckoStub.queryExchangeRate
        .withArgs(RBTC_SYMBOL, pricerUtils.INTERMEDIATE_CURRENCY)
        .rejects();

      const builderSpy = spy(fakeBuilder, 'get');

      const beforePriorityApi = pricerUtils.tokenToApi[RBTC_SYMBOL]?.at(0);
      const exchangeRate = await getExchangeRate(RIF_SYMBOL, RBTC_SYMBOL);
      const afterPriorityApi = pricerUtils.tokenToApi[RBTC_SYMBOL]?.at(0);

      expect(builderSpy.firstCall.calledWith(beforePriorityApi)).to.be.true;
      expect(builderSpy.firstCall.calledWith(afterPriorityApi)).to.be.false;
      expect(exchangeRate.toString()).to.be.equal(fakeRifRbtc.toString());
      expect(builderSpy.lastCall.calledWith(beforePriorityApi)).to.be.false;
      expect(builderSpy.lastCall.calledWith(afterPriorityApi)).to.be.true;
    });

    it('should fail if token does not have an API mapped', async function () {
      await expect(getExchangeRate(RIF_SYMBOL, 'NA')).to.be.rejectedWith(
        'Token NA does not have an API to query'
      );
    });

    it("should fail if all the mapped API's fail", async function () {
      const coinCodexStub = createStubInstance(CoinCodex);
      fakeBuilder.set('coinCodex', () => coinCodexStub);
      coinGeckoStub.queryExchangeRate
        .withArgs(RBTC_SYMBOL, pricerUtils.INTERMEDIATE_CURRENCY)
        .rejects();
      coinCodexStub.queryExchangeRate
        .withArgs(RBTC_SYMBOL, pricerUtils.INTERMEDIATE_CURRENCY)
        .rejects();

      await expect(getExchangeRate(RIF_SYMBOL, RBTC_SYMBOL)).to.be.rejectedWith(
        `Currency conversion for pair ${RIF_SYMBOL}:${RBTC_SYMBOL} not found in current exchange api`
      );
    });

    it('should fail if intermediate currency is not valid', async function () {
      const rDocExchangeStub = createStubInstance(RdocExchange, {
        queryExchangeRate: Promise.reject(),
      });
      const testExchangeStub = createStubInstance(TestExchange, {
        queryExchangeRate: Promise.reject(),
      });
      fakeBuilder.set('rdocExchange', () => rDocExchangeStub);
      fakeBuilder.set('testExchange', () => testExchangeStub);

      await expect(getExchangeRate('RDOC', 'TKN', 'NA')).to.be.rejectedWith(
        `Currency conversion for pair RDOC:TKN not found in current exchange api`
      );
    });
  });
});
