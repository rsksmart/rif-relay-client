import chai, { assert, expect } from 'chai';
import { SinonStub, SinonStubbedInstance, stub, restore } from 'sinon';
import chaiAsPromised from 'chai-as-promised';
import { BigNumber as BigNumberJs } from 'bignumber.js';

import RelayPricer from '../src/RelayPricer';
import type BaseExchangeApi from '../src/api/pricer/ExchangeApi';

chai.use(chaiAsPromised);

const randomBigNumberJs = (max: number) =>
    BigNumberJs(Math.random() * max);

describe('RelayPricer', function () {
    let pricer: RelayPricer;
    let fakeRbtcUsd: BigNumberJs;
    let fakeRifUsd: BigNumberJs;
    let fakeRdocUsd: BigNumberJs;
    let fakeRbtcRif: BigNumberJs;
    let fakeRifRbtc: BigNumberJs;
    let fakeRdocRbtc: BigNumberJs;
    const RDOC_SYMBOL = 'RDOC';
    const RIF_SYMBOL = 'RIF';
    const RBTC_SYMBOL = 'RBTC';
    const USD_SYMBOL = 'USD';

    beforeEach(function () {
        fakeRbtcUsd = randomBigNumberJs(25000);
        fakeRifUsd = randomBigNumberJs(25000);
        fakeRdocUsd = BigNumberJs('1');
        fakeRbtcRif = fakeRbtcUsd.dividedBy(fakeRifUsd);
        fakeRifRbtc = fakeRifUsd.dividedBy(fakeRbtcUsd);
        fakeRdocRbtc = fakeRdocUsd.dividedBy(fakeRbtcUsd);
        pricer = new RelayPricer();
    });

    describe('findAvailableApi', function () {
        it('should return available api', function () {
            const availableApi = pricer.findAvailableApi(RIF_SYMBOL);
            assert.containsAllKeys(availableApi, ['api', 'tokens']);
        });

        it('should return available api(lowercase)', function () {
            const availableApi = pricer.findAvailableApi(
                RIF_SYMBOL.toLowerCase()
            );
            assert.containsAllKeys(availableApi, ['api', 'tokens']);
        });

        it('should return available api for RDOC', function () {
            const availableApi = pricer.findAvailableApi('RDOC');
            assert.containsAllKeys(availableApi, ['api', 'tokens']);
        });

        it('should fail if there is no available api', function () {
            expect(() => pricer.findAvailableApi('NA')).to.throw(
                'There is no available API for token NA'
            );
        });

        it('should fail if token is empty', function () {
            expect(() => pricer.findAvailableApi('')).to.throw(
                'There is no available API for token'
            );
        });
    });

    describe('getExchangeRate', function () {
        let sourceApiStub: SinonStubbedInstance<BaseExchangeApi>;
        const conversionError = `Currency conversion for pair ${RIF_SYMBOL}:${RBTC_SYMBOL} not found in current exchange api`;
        let findAvailableApiStub: SinonStub;

        function buildExchangeRate(rate1: BigNumberJs, rate2: BigNumberJs) {
            sourceApiStub.queryExchangeRate
                .withArgs(RIF_SYMBOL, USD_SYMBOL)
                .returns(Promise.resolve(rate1));
            sourceApiStub.queryExchangeRate
                .withArgs(RBTC_SYMBOL, USD_SYMBOL)
                .returns(Promise.resolve(rate2));
        }

        beforeEach(function () {
            sourceApiStub = {
                getApiTokenName: stub(),
                queryExchangeRate: stub()
            } as unknown as typeof sourceApiStub;

            findAvailableApiStub = stub(pricer, 'findAvailableApi').returns(
                sourceApiStub
            );
            sourceApiStub.getApiTokenName
                .withArgs(RIF_SYMBOL)
                .returns(RIF_SYMBOL);
            sourceApiStub.getApiTokenName
                .withArgs(RBTC_SYMBOL)
                .returns(RBTC_SYMBOL);
        });

        afterEach(function(){
            restore();
        })

        it('should return source exchange rate', async function () {

            buildExchangeRate(fakeRbtcUsd, fakeRifUsd);

            const price = await pricer.getExchangeRate(RIF_SYMBOL, RBTC_SYMBOL);

            assert.equal(
                fakeRbtcRif.toString(),
                price.toString(),
                'price is not the same'
            );
        });

        it('Should return exchange rate using different exchanges', async function () {
            const coinBaseApiStub = {
                getApiTokenName: stub(),
                queryExchangeRate: stub()
            } as unknown as typeof sourceApiStub;

            coinBaseApiStub.getApiTokenName
                .withArgs(RBTC_SYMBOL)
                .returns(RBTC_SYMBOL);
            coinBaseApiStub.queryExchangeRate
                .withArgs(RBTC_SYMBOL, USD_SYMBOL)
                .returns(Promise.resolve(fakeRbtcUsd));

            const rdocApiStub = {
                getApiTokenName: stub(),
                queryExchangeRate: stub()
            } as unknown as typeof sourceApiStub;

            rdocApiStub.getApiTokenName
                .withArgs(RDOC_SYMBOL)
                .returns(RDOC_SYMBOL);
            rdocApiStub.queryExchangeRate
                .withArgs(RDOC_SYMBOL, USD_SYMBOL)
                .returns(Promise.resolve(fakeRdocUsd));
                

            findAvailableApiStub
                .withArgs(RBTC_SYMBOL)
                .returns(coinBaseApiStub)
                .withArgs(RDOC_SYMBOL)
                .returns(rdocApiStub);

            const price = await pricer.getExchangeRate(
                RDOC_SYMBOL,
                RBTC_SYMBOL
            );

            expect(price.toString()).to.equal(fakeRdocRbtc.toString());
        });

        it('should return target exchange rate', async function () {
            buildExchangeRate(fakeRbtcUsd, fakeRifUsd);
            const price = await pricer.getExchangeRate(RBTC_SYMBOL, RIF_SYMBOL);
            assert.equal(
                fakeRifRbtc.toString(),
                price.toString(),
                'price is not the same'
            );
        });

        it('should fail if source currency is not valid', async function () {
            const error = new Error(
                `Coinbase API does not recognise given currency ${RIF_SYMBOL}`
            );
            sourceApiStub.queryExchangeRate.throws(error);
            await assert.isRejected(
                pricer.getExchangeRate(RIF_SYMBOL, 'NA', USD_SYMBOL),
                error.message
            );
        });

        it('should fail if intermediate currency is not valid', async function () {
            const error = new Error(
                `Exchange rate for currency pair ${RIF_SYMBOL}/${RBTC_SYMBOL} is not available`
            );
            sourceApiStub.queryExchangeRate.throws(error);
            await assert.isRejected(
                pricer.getExchangeRate(RIF_SYMBOL, RBTC_SYMBOL, 'NA'),
                error.message
            );
        });

        it('should fail if target exchange rate is 0', async function () {
            buildExchangeRate(fakeRbtcUsd, BigNumberJs(0));
            await assert.isRejected(
                pricer.getExchangeRate(RIF_SYMBOL, RBTC_SYMBOL),
                conversionError
            );
        });

        it('should fail if source exchange rate is 0', async function () {
            buildExchangeRate(BigNumberJs(0), fakeRifUsd);
            await assert.isRejected(
                pricer.getExchangeRate(RIF_SYMBOL, RBTC_SYMBOL),
                conversionError
            );
        });
    });
});
