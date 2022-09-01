import { use, assert, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { SinonStub, stub } from 'sinon';
import * as fetchModule from 'node-fetch';
import { Response } from 'node-fetch';

import { CoinBase, CoinBaseResponse } from '../../src/api/CoinBase';

use(chaiAsPromised);

describe('CoinBase', () => {
    let coinBase: CoinBase;
    const sourceCurrency = 'RIF';
    const targetCurrency = 'USD';
    const xRateRifUsd = '0.07770028890144696';
    let fakeResponse: Response;
    let fakeFetch: SinonStub;

    beforeEach(() => {
        coinBase = new CoinBase();
    });

    describe('getApiTokenName', () => {
        it('should return mapped token name', () => {
            assert.equal(coinBase.getApiTokenName('RIF'), sourceCurrency);
        });

        it('should return mapped token(lowercase) name', () => {
            assert.equal(coinBase.getApiTokenName('rif'), sourceCurrency);
        });

        it('should fail if token symbol is not mapped', () => {
            expect(() => coinBase.getApiTokenName('btc')).to.throw(
                'Token BTC is not internally mapped in CoinBase API'
            );
        });

        it('should fail if token symbol is null', () => {
            expect(() => coinBase.getApiTokenName(null)).to.throw(
                'CoinBase API cannot map a token with a null/empty value'
            );
        });

        it('should fail if token symbol is empty', () => {
            expect(() => coinBase.getApiTokenName('')).to.throw(
                'CoinBase API cannot map a token with a null/empty value'
            );
        });
    });

    describe('queryExchangeRate', () => {
        beforeEach(() => {
            const coinBaseResponse: CoinBaseResponse = {
                data: {
                    currency: sourceCurrency,
                    rates: {
                        USD: xRateRifUsd
                    }
                }
            };
            fakeResponse = new Response(JSON.stringify(coinBaseResponse), {
                status: 200
            });
            fakeFetch = stub(fetchModule, 'default').returns(
                Promise.resolve(fakeResponse)
            );
        });

        afterEach(() => {
            fakeFetch.restore();
        });

        it('should return exchange rate RIF/USD', async () => {
            await assert.eventually.equal(
                coinBase.queryExchangeRate(sourceCurrency, targetCurrency),
                xRateRifUsd,
                'Exchange rate is no the same'
            );
        });

        it('should return exchange rate rif/usd', async () => {
            await assert.eventually.equal(
                coinBase.queryExchangeRate(
                    sourceCurrency.toLowerCase(),
                    targetCurrency.toLowerCase()
                ),
                xRateRifUsd,
                'Exchange rate is no the same'
            );
        });

        it('should fail if rate does not exist', async () => {
            await assert.isRejected(
                coinBase.queryExchangeRate(sourceCurrency, 'NA'),
                `Exchange rate for currency pair ${sourceCurrency}/NA is not available`
            );
        });

        it('should fail if API returns handled error message', async () => {
            const errorString = JSON.stringify({
                errors: [
                    {
                        id: 'not_found',
                        message: 'Currency is invalid'
                    }
                ]
            });
            fakeResponse = new Response(errorString, { status: 400 });
            fakeFetch.returns(Promise.resolve(fakeResponse));
            await assert.isRejected(
                coinBase.queryExchangeRate('NA', targetCurrency),
                'CoinBase API status 400/Bad Request/Currency is invalid'
            );
        });
    });
});
