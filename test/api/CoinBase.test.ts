import { use, assert, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { SinonStub, stub } from 'sinon';
import axios, { AxiosError, AxiosResponse } from 'axios';

import CoinBase, { CoinBaseResponse } from '../../src/api/CoinBase';

use(chaiAsPromised);

describe('CoinBase', () => {
    let coinBase: CoinBase;
    const sourceCurrency = 'RIF';
    const targetCurrency = 'USD';
    const xRateRifUsd = '0.07770028890144696';
    let fakeResponse;
    let fakeAxios: SinonStub;

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
            fakeResponse = {
                status: 200,
                data: coinBaseResponse
            } as AxiosResponse;
            fakeAxios = stub(axios, 'get').returns(
                Promise.resolve(fakeResponse)
            );
        });

        afterEach(() => {
            fakeAxios.restore();
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
            const fakeError = {
                response: {
                    status: 400,
                    statusText: 'Bad Request'
                }
            } as AxiosError;

            fakeAxios.returns(Promise.reject(fakeError));
            await assert.isRejected(
                coinBase.queryExchangeRate('NA', targetCurrency),
                'CoinBase API status 400/Bad Request'
            );
        });
    });
});
