import chai, { assert, expect } from 'chai';
import { stub } from 'sinon';
import chaiAsPromised from 'chai-as-promised';
import { StubbedInstance, stubInterface } from 'ts-sinon';
import BigNumber from 'bignumber.js';

import RelayPricer from '../src/RelayPricer';
import BaseExchangeApi from '../src/api/ExchangeApi';

chai.use(chaiAsPromised);

describe('RelayPricer', () => {
    let pricer: RelayPricer;
    const X_RATE_RBTC_USD = new BigNumber('23345.834630269488');
    const X_RATE_RIF_USD = new BigNumber('0.0775886924643371');
    const X_RATE_RDOC_USD = new BigNumber('1');
    const X_RATE_RBTC_RIF = X_RATE_RBTC_USD.dividedBy(X_RATE_RIF_USD);
    const X_RATE_RIF_RBTC = X_RATE_RIF_USD.dividedBy(X_RATE_RBTC_USD);
    const X_RATE_RDOC_RBTC = X_RATE_RDOC_USD.dividedBy(X_RATE_RBTC_USD);
    const RDOC_SYMBOL = 'RDOC';
    const RIF_SYMBOL = 'RIF';
    const RBTC_SYMBOL = 'RBTC';
    const USD_SYMBOL = 'USD';

    beforeEach(() => {
        pricer = new RelayPricer();
    });

    describe('findAvailableApi', () => {
        it('should return available api', () => {
            const availableApi = pricer.findAvailableApi(RIF_SYMBOL);
            assert.containsAllKeys(availableApi, ['api', 'tokens']);
        });

        it('should return available api(lowercase)', () => {
            const availableApi = pricer.findAvailableApi(
                RIF_SYMBOL.toLowerCase()
            );
            assert.containsAllKeys(availableApi, ['api', 'tokens']);
        });

        it('should return available api for RDOC', () => {
            const availableApi = pricer.findAvailableApi('RDOC');
            assert.containsAllKeys(availableApi, ['api', 'tokens']);
        });

        it('should fail if there is no available api', () => {
            expect(() => pricer.findAvailableApi('NA')).to.throw(
                'There is no available API for token NA'
            );
        });

        it('should fail if token is null', () => {
            expect(() => pricer.findAvailableApi(null)).to.throw(
                `There is no available API for token ${null}`
            );
        });

        it('should fail if token is empty', () => {
            expect(() => pricer.findAvailableApi('')).to.throw(
                'There is no available API for token'
            );
        });
    });

    describe('getExchangeRate', () => {
        let fakeSourceApi: StubbedInstance<BaseExchangeApi>;
        const conversionError = `Currency conversion for pair ${RIF_SYMBOL}:${RBTC_SYMBOL} not found in current exchange api`;
        let stubPricer: sinon.SinonStub<[token: string], BaseExchangeApi>;

        function buildExchangeRate(rate1: BigNumber, rate2: BigNumber) {
            fakeSourceApi.queryExchangeRate
                .withArgs(RIF_SYMBOL, USD_SYMBOL)
                .returns(Promise.resolve(rate1));
            fakeSourceApi.queryExchangeRate
                .withArgs(RBTC_SYMBOL, USD_SYMBOL)
                .returns(Promise.resolve(rate2));
        }

        beforeEach(() => {
            fakeSourceApi = stubInterface<BaseExchangeApi>();
            stubPricer = stub(pricer, 'findAvailableApi').returns(
                fakeSourceApi
            );
            fakeSourceApi.getApiTokenName
                .withArgs(RIF_SYMBOL)
                .returns(RIF_SYMBOL);
            fakeSourceApi.getApiTokenName
                .withArgs(RBTC_SYMBOL)
                .returns(RBTC_SYMBOL);
        });

        it('should return source exchange rate', async () => {
            buildExchangeRate(X_RATE_RBTC_USD, X_RATE_RIF_USD);

            const price = await pricer.getExchangeRate(RIF_SYMBOL, RBTC_SYMBOL);

            assert.equal(
                X_RATE_RBTC_RIF.toString(),
                price.toString(),
                'price is not the same'
            );
        });

        it('Should return exchange rate using different exchanges', async function () {
            const fakeCoinbaseApi = stubInterface<BaseExchangeApi>();

            fakeCoinbaseApi.getApiTokenName
                .withArgs(RBTC_SYMBOL)
                .returns(RBTC_SYMBOL);
            fakeCoinbaseApi.queryExchangeRate
                .withArgs(RBTC_SYMBOL, USD_SYMBOL)
                .returns(Promise.resolve(X_RATE_RBTC_USD));

            const fakeRdocApi = stubInterface<BaseExchangeApi>();

            fakeRdocApi.getApiTokenName
                .withArgs(RDOC_SYMBOL)
                .returns(RDOC_SYMBOL);
            fakeRdocApi.queryExchangeRate
                .withArgs(RDOC_SYMBOL, USD_SYMBOL)
                .returns(Promise.resolve(X_RATE_RDOC_USD));

            stubPricer.restore();
            stubPricer = stub(pricer, 'findAvailableApi')
                .withArgs(RBTC_SYMBOL)
                .returns(fakeCoinbaseApi)
                .withArgs(RDOC_SYMBOL)
                .returns(fakeRdocApi);

            const price = await pricer.getExchangeRate(
                RDOC_SYMBOL,
                RBTC_SYMBOL
            );

            expect(price.toString()).to.equal(X_RATE_RDOC_RBTC.toString());
        });

        it('should return target exchange rate', async () => {
            buildExchangeRate(X_RATE_RBTC_USD, X_RATE_RIF_USD);
            const price = await pricer.getExchangeRate(RBTC_SYMBOL, RIF_SYMBOL);
            assert.equal(
                X_RATE_RIF_RBTC.toString(),
                price.toString(),
                'price is not the same'
            );
        });

        it('should fail if source currency is not valid', async () => {
            const error = new Error(
                `Coinbase API does not recognise given currency ${RIF_SYMBOL}`
            );
            fakeSourceApi.queryExchangeRate.throws(error);
            await assert.isRejected(
                pricer.getExchangeRate(RIF_SYMBOL, 'NA', USD_SYMBOL),
                error.message
            );
        });

        it('should fail if intermediate currency is not valid', async () => {
            const error = new Error(
                `Exchange rate for currency pair ${RIF_SYMBOL}/${RBTC_SYMBOL} is not available`
            );
            fakeSourceApi.queryExchangeRate.throws(error);
            await assert.isRejected(
                pricer.getExchangeRate(RIF_SYMBOL, RBTC_SYMBOL, 'NA'),
                error.message
            );
        });

        it('should fail if target exchange rate is 0', async () => {
            buildExchangeRate(X_RATE_RBTC_USD, new BigNumber(0));
            await assert.isRejected(
                pricer.getExchangeRate(RIF_SYMBOL, RBTC_SYMBOL),
                conversionError
            );
        });

        it('should fail if source exchange rate is 0', async () => {
            buildExchangeRate(new BigNumber(0), X_RATE_RIF_USD);
            await assert.isRejected(
                pricer.getExchangeRate(RIF_SYMBOL, RBTC_SYMBOL),
                conversionError
            );
        });
    });
});
