import chai, { assert, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { StubbedInstance, stubInterface } from 'ts-sinon';
import BigNumber from 'bignumber.js';

import { RelayPricer } from '../src';
import { ExchangeApi } from '../src/types/ExchangeApi';

chai.use(chaiAsPromised);

describe('RelayPricer', () => {
    let fakeSourceApi: StubbedInstance<ExchangeApi>;
    let pricer: RelayPricer;
    const xRateRbtcUsd = new BigNumber('23345.834630269488');
    const xRateRifUsd = new BigNumber('0.0775886924643371');
    const xRateRbtcRif = xRateRbtcUsd.dividedBy(xRateRifUsd);
    const xRateRifRbtc = xRateRifUsd.dividedBy(xRateRbtcUsd);
    const sourceCurrency = 'RBTC';
    const targetCurrency = 'RIF';
    const intermediateCurrency = 'USD';

    function buildExchangeRate(rate1: BigNumber, rate2: BigNumber) {
        fakeSourceApi.query
            .withArgs(sourceCurrency, intermediateCurrency)
            .returns(Promise.resolve(rate1));
        fakeSourceApi.query
            .withArgs(targetCurrency, intermediateCurrency)
            .returns(Promise.resolve(rate2));
    }

    describe('getPrice', async () => {
        const conversionError = `Currency conversion for pair ${sourceCurrency}:${targetCurrency} not found in current exchange api`;

        beforeEach(() => {
            fakeSourceApi = stubInterface<ExchangeApi>();
            pricer = new RelayPricer(fakeSourceApi);
        });

        it('should initiate sourceApi', async () => {
            const pricer = new RelayPricer(fakeSourceApi);
            expect(pricer).to.be.instanceOf(RelayPricer);
            expect(pricer).to.have.property('sourceApi', fakeSourceApi);
        });

        it('should fail if sourceApi is null', async () => {
            expect(() => new RelayPricer(null)).to.throw(
                'RelayPricer should be initialized with SourceApi'
            );
        });

        it('should return source exchange rate', async () => {
            buildExchangeRate(xRateRbtcUsd, xRateRifUsd);
            const price = await pricer.getExchangeRate(
                sourceCurrency,
                targetCurrency
            );
            assert.equal(
                xRateRbtcRif.toString(),
                price.toString(),
                'price is not the same'
            );
        });

        it('should return target exchange rate', async () => {
            buildExchangeRate(xRateRbtcUsd, xRateRifUsd);
            const price = await pricer.getExchangeRate(
                targetCurrency,
                sourceCurrency
            );
            assert.equal(
                xRateRifRbtc.toString(),
                price.toString(),
                'price is not the same'
            );
        });

        it('should fail if source currency is not valid', async () => {
            const error = new Error(
                `Coinbase API does not recognise given currency ${sourceCurrency}`
            );
            fakeSourceApi.query.throws(error);
            await assert.isRejected(
                pricer.getExchangeRate(
                    sourceCurrency,
                    'NA',
                    intermediateCurrency
                ),
                error.message
            );
        });

        it('should fail if intermediate currency is not valid', async () => {
            const error = new Error(
                `Exchange rate for currency pair ${sourceCurrency}/${targetCurrency} is not available`
            );
            fakeSourceApi.query.throws(error);
            await assert.isRejected(
                pricer.getExchangeRate(sourceCurrency, targetCurrency, 'NA'),
                error.message
            );
        });

        it('should fail if target exchange rate is 0', async () => {
            buildExchangeRate(xRateRbtcUsd, new BigNumber(0));
            await assert.isRejected(
                pricer.getExchangeRate(sourceCurrency, targetCurrency),
                conversionError
            );
        });

        it('should fail if source exchange rate is 0', async () => {
            buildExchangeRate(new BigNumber(0), xRateRifUsd);
            await assert.isRejected(
                pricer.getExchangeRate(sourceCurrency, targetCurrency),
                conversionError
            );
        });
    });
});
