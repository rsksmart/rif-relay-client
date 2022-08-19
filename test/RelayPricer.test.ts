import chai, { assert, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { StubbedInstance, stubInterface } from 'ts-sinon';

import { RelayPricer } from '../src';
import { SourceApi } from '../src/types/RelayPricer';

chai.use(chaiAsPromised);

describe('RelayPricer', () => {
    let fakeSourceApi: StubbedInstance<SourceApi>;
    let pricer: RelayPricer;
    const fakePrice1 = 23345.834630269488;
    const fakePrice2 = 0.0775886924643371;
    const fakePriceConversion1 = 300892.2291221775;
    const fakePriceConversion2 = 0.0000033234490731694805;
    const sourceCurrency = 'RBTC';
    const targetCurrency = 'RIF';
    const intermediateCurrency = 'USD';

    describe('getPrice', async () => {
        beforeEach(() => {
            fakeSourceApi = stubInterface<SourceApi>();
            pricer = new RelayPricer(fakeSourceApi);
        });

        it('should fail if receive wrong SourceApi', async () => {
            expect(() => new RelayPricer('test')).to.throw(
                'Source api not provided'
            );
        });

        it('should return source currency conversion price', async () => {
            fakeSourceApi.query
                .withArgs(sourceCurrency, intermediateCurrency)
                .returns(Promise.resolve(fakePrice1));
            fakeSourceApi.query
                .withArgs(targetCurrency, intermediateCurrency)
                .returns(Promise.resolve(fakePrice2));
            const price = await pricer.getPrice(sourceCurrency, targetCurrency);
            assert.equal(fakePriceConversion1, price, 'price is not the same');
        });

        it('should return target currency conversion price', async () => {
            fakeSourceApi.query
                .withArgs(sourceCurrency, intermediateCurrency)
                .returns(Promise.resolve(fakePrice1));
            fakeSourceApi.query
                .withArgs(targetCurrency, intermediateCurrency)
                .returns(Promise.resolve(fakePrice2));
            const price = await pricer.getPrice(targetCurrency, sourceCurrency);
            assert.equal(fakePriceConversion2, price, 'price is not the same');
        });

        it('should fail if source currency is not valid', async () => {
            const error = new Error('Input not available');
            fakeSourceApi.query.throws(error);
            await assert.isRejected(
                pricer.getPrice(sourceCurrency, 'NA', intermediateCurrency),
                error.message
            );
        });

        it('should fail if intermediate currency is not valid', async () => {
            const error = new Error('Output not available');
            fakeSourceApi.query.throws(error);
            await assert.isRejected(
                pricer.getPrice(sourceCurrency, targetCurrency, 'NA'),
                error.message
            );
        });

        it('should fail if currency conversion is 0', async () => {
            fakeSourceApi.query
                .withArgs(sourceCurrency, intermediateCurrency)
                .returns(Promise.resolve(0));
            fakeSourceApi.query
                .withArgs(targetCurrency, intermediateCurrency)
                .returns(Promise.resolve(fakePrice2));
            await assert.isRejected(
                pricer.getPrice(sourceCurrency, targetCurrency),
                'price cannot be zero'
            );
        });
    });
});
