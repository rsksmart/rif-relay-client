import chai, { assert, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { StubbedInstance, stubInterface } from 'ts-sinon';

import { RelayPricer } from '../src';
import { SourceApi } from '../src/types/RelayPricer';

chai.use(chaiAsPromised);

describe('RelayPricer', () => {
    describe('getPrice', async () => {
        let fakeSourceApi: StubbedInstance<SourceApi>;
        let pricer: RelayPricer;
        const fakePrice1 = 23345.834630269488;
        const fakePrice2 = 0.0775886924643371;
        const fakePriceConversion1 = 300892.2291221775;
        const fakePriceConversion2 = 0.0000033234490731694805;
        const pair1 = 'RBTC';
        const pair2 = 'RIF';
        const intermediaryPair = 'USD';

        beforeEach(() => {
            fakeSourceApi = stubInterface<SourceApi>();
            pricer = new RelayPricer(fakeSourceApi);
        });

        it('should fail if receive wrong SourceApi', async () => {
            expect(() => new RelayPricer('test')).to.throw(
                'Source api not provided'
            );
        });

        it('should return pair1 conversion price', async () => {
            fakeSourceApi.query
                .withArgs(pair1, intermediaryPair)
                .returns(Promise.resolve(fakePrice1));
            fakeSourceApi.query
                .withArgs(pair2, intermediaryPair)
                .returns(Promise.resolve(fakePrice2));
            const price = await pricer.getPrice(pair1, pair2);
            assert.equal(fakePriceConversion1, price, 'price is not the same');
        });

        it('should return pair2 conversion price', async () => {
            fakeSourceApi.query
                .withArgs(pair1, intermediaryPair)
                .returns(Promise.resolve(fakePrice1));
            fakeSourceApi.query
                .withArgs(pair2, intermediaryPair)
                .returns(Promise.resolve(fakePrice2));
            const price = await pricer.getPrice(pair2, pair1);
            assert.equal(fakePriceConversion2, price, 'price is not the same');
        });

        it('should fail if input pair is not valid', async () => {
            const error = new Error('Input not available');
            fakeSourceApi.query.throws(error);
            await assert.isRejected(
                pricer.getPrice(pair1, 'NA', intermediaryPair),
                error.message
            );
        });

        it('should fail if intermediary pair is not valid', async () => {
            const error = new Error('Output not available');
            fakeSourceApi.query.throws(error);
            await assert.isRejected(
                pricer.getPrice(pair1, pair2, 'NA'),
                error.message
            );
        });
    });
});
