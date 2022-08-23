import chai, { assert, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { StubbedInstance, stubInterface } from 'ts-sinon';

import { RelayPricer } from '../src';
import CoinBase from '../src/api/CoinBase';
import { SourceApi } from '../src/types/RelayPricer';

chai.use(chaiAsPromised);

describe('RelayPricer', () => {
    let fakeSourceApi: StubbedInstance<SourceApi>;
    let pricer: RelayPricer;
    const FAKE_PRICE_1 = 23345.834630269488;
    const FAKE_PRICE_2 = 0.0775886924643371;
    const FAKE_PRICE_CONVERSION_1 = 300892.2291221775;
    const FAKE_PRICE_CONVERSION_2 = 0.0000033234490731694805;
    const SOURCE_CURRENCY = 'RBTC';
    const TARGET_CURRENCY = 'RIF';
    const INTERMEDIATE_CURRENCY = 'USD';

    function buildFakePrices(price1: number, price2: number) {
        fakeSourceApi.query
            .withArgs(SOURCE_CURRENCY, INTERMEDIATE_CURRENCY)
            .returns(Promise.resolve(price1));
        fakeSourceApi.query
            .withArgs(TARGET_CURRENCY, INTERMEDIATE_CURRENCY)
            .returns(Promise.resolve(price2));
    }

    describe('getPrice', async () => {
        beforeEach(() => {
            fakeSourceApi = stubInterface<SourceApi>();
            pricer = new RelayPricer(fakeSourceApi);
        });

        it('should initiate sourceApi', async () => {
            const coinBase = new CoinBase();
            const pricer = new RelayPricer(coinBase);
            expect(pricer).to.be.instanceOf(RelayPricer);
            expect(pricer).to.have.property('sourceApi', coinBase);
        });

        it('should return source currency conversion price', async () => {
            buildFakePrices(FAKE_PRICE_1, FAKE_PRICE_2);
            const price = await pricer.getPrice(
                SOURCE_CURRENCY,
                TARGET_CURRENCY
            );
            assert.equal(
                FAKE_PRICE_CONVERSION_1,
                price,
                'price is not the same'
            );
        });

        it('should return target currency conversion price', async () => {
            buildFakePrices(FAKE_PRICE_1, FAKE_PRICE_2);
            const price = await pricer.getPrice(
                TARGET_CURRENCY,
                SOURCE_CURRENCY
            );
            assert.equal(
                FAKE_PRICE_CONVERSION_2,
                price,
                'price is not the same'
            );
        });

        it('should fail if source currency is not valid', async () => {
            const error = new Error('Input not available');
            fakeSourceApi.query.throws(error);
            await assert.isRejected(
                pricer.getPrice(SOURCE_CURRENCY, 'NA', INTERMEDIATE_CURRENCY),
                error.message
            );
        });

        it('should fail if intermediate currency is not valid', async () => {
            const error = new Error('Output not available');
            fakeSourceApi.query.throws(error);
            await assert.isRejected(
                pricer.getPrice(SOURCE_CURRENCY, TARGET_CURRENCY, 'NA'),
                error.message
            );
        });

        it('should fail if target currency conversion is 0', async () => {
            buildFakePrices(FAKE_PRICE_1, 0);
            await assert.isRejected(
                pricer.getPrice(SOURCE_CURRENCY, TARGET_CURRENCY),
                'price cannot be zero'
            );
        });

        it('should fail if source currency conversion is 0', async () => {
            buildFakePrices(0, FAKE_PRICE_2);
            await assert.isRejected(
                pricer.getPrice(SOURCE_CURRENCY, TARGET_CURRENCY),
                'price cannot be zero'
            );
        });
    });
});
