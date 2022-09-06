import chai, { assert, expect } from 'chai';
import { stub } from 'sinon';
import chaiAsPromised from 'chai-as-promised';
import { StubbedInstance, stubInterface } from 'ts-sinon';
import BigNumber from 'bignumber.js';

import RelayPricer from '../src/RelayPricer';
import ExchangeApi from '../src/types/ExchangeApi';

chai.use(chaiAsPromised);

describe('RelayPricer', () => {
    let pricer: RelayPricer;
    const xRateRbtcUsd = new BigNumber('23345.834630269488');
    const xRateRifUsd = new BigNumber('0.0775886924643371');
    const xRateRbtcRif = xRateRbtcUsd.dividedBy(xRateRifUsd);
    const xRateRifRbtc = xRateRifUsd.dividedBy(xRateRbtcUsd);
    const sourceCurrency = 'RIF';
    const targetCurrency = 'RBTC';
    const intermediateCurrency = 'USD';

    beforeEach(() => {
        pricer = new RelayPricer();
    });

    describe('findAvailableApi', () => {
        it('should return available api', () => {
            const availableApi = pricer.findAvailableApi(sourceCurrency);
            assert.containsAllKeys(availableApi, ['api', 'tokens']);
        });

        it('should fail is there is no available api', () => {
            expect(() => pricer.findAvailableApi(targetCurrency)).to.throw(
                `There is no available API for token ${targetCurrency}`
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
        let fakeSourceApi: StubbedInstance<ExchangeApi>;
        const conversionError = `Currency conversion for pair ${sourceCurrency}:${targetCurrency} not found in current exchange api`;

        function buildExchangeRate(rate1: BigNumber, rate2: BigNumber) {
            fakeSourceApi.queryExchangeRate
                .withArgs(sourceCurrency, intermediateCurrency)
                .returns(Promise.resolve(rate1));
            fakeSourceApi.queryExchangeRate
                .withArgs(targetCurrency, intermediateCurrency)
                .returns(Promise.resolve(rate2));
        }

        beforeEach(() => {
            fakeSourceApi = stubInterface<ExchangeApi>();
            stub(pricer, 'findAvailableApi').returns({
                api: fakeSourceApi,
                tokens: []
            });
            fakeSourceApi.getApiTokenName
                .withArgs(sourceCurrency)
                .returns(sourceCurrency);
            fakeSourceApi.getApiTokenName
                .withArgs(targetCurrency)
                .returns(targetCurrency);
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
            fakeSourceApi.queryExchangeRate.throws(error);
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
            fakeSourceApi.queryExchangeRate.throws(error);
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
