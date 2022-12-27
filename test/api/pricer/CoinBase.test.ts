import type { AxiosError } from 'axios';
import { use, assert, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { SinonStubbedInstance, createStubInstance, restore } from 'sinon';
import { HttpWrapper } from '../../../src/api/common';

import CoinBase, { CoinBaseResponse } from '../../../src/api/pricer/CoinBase';

use(chaiAsPromised);

describe('CoinBase', function() {
    let coinBase: CoinBase;
    const sourceCurrency = 'RIF';
    const targetCurrency = 'USD';
    const xRateRifUsd = '0.07770028890144696';

    beforeEach(function() {
        coinBase = new CoinBase();
    });

    describe('getApiTokenName', function() {
        it('should return mapped token name', function() {
            assert.equal(coinBase.getApiTokenName('RIF'), sourceCurrency);
        });

        it('should return mapped token(lowercase) name', function() {
            assert.equal(coinBase.getApiTokenName('rif'), sourceCurrency);
        });

        it('should fail if token symbol is not mapped', function() {
            expect(() => coinBase.getApiTokenName('btc')).to.throw(
                'Token BTC is not internally mapped in CoinBase API'
            );
        });

        it('should fail if token symbol is empty', function() {
            expect(() => coinBase.getApiTokenName('')).to.throw(
                'CoinBase API cannot map a token with a null/empty value'
            );
        });
    });

    describe('queryExchangeRate', function() {
        let httpWrapperStub: SinonStubbedInstance<HttpWrapper>;
        const coinBaseResponse: CoinBaseResponse = {
            data: {
                currency: sourceCurrency,
                rates: {
                    USD: xRateRifUsd
                }
            }
        };

        beforeEach(function() {
            httpWrapperStub = createStubInstance(HttpWrapper, {
                sendPromise: Promise.resolve(coinBaseResponse)
            });
            (coinBase as unknown as { _httpWrapper: HttpWrapper })._httpWrapper = httpWrapperStub;
        });

        afterEach(function() {
            restore();
        });

        it('should return exchange rate RIF/USD', async function() {
            await assert.eventually.equal(
                coinBase.queryExchangeRate(sourceCurrency, targetCurrency),
                xRateRifUsd,
                'Exchange rate is no the same'
            );
        });

        it('should return exchange rate rif/usd', async function() {
            await assert.eventually.equal(
                coinBase.queryExchangeRate(
                    sourceCurrency.toLowerCase(),
                    targetCurrency.toLowerCase()
                ),
                xRateRifUsd,
                'Exchange rate is no the same'
            );
        });

        it('should fail if rate does not exist', async function() {
            await assert.isRejected(
                coinBase.queryExchangeRate(sourceCurrency, 'NA'),
                `Exchange rate for currency pair ${sourceCurrency}/NA is not available`
            );
        });

        it('should fail if API returns handled error message', async function() {
            const expectedStatusCode = 400;
            const expectedStatusText = 'Bad Request';
            const fakeError = {
                response: {
                    status: expectedStatusCode,
                    statusText: expectedStatusText
                }
            } as AxiosError;

            httpWrapperStub.sendPromise.returns(Promise.reject(fakeError));
            await assert.isRejected(
                coinBase.queryExchangeRate('NA', targetCurrency),
                `CoinBase API status ${expectedStatusCode}/${expectedStatusText}`
            );
        });

        it("should fail if API doesn't return a response", async function() {
            const fakeError = {
                request: {}
            } as AxiosError;

            httpWrapperStub.sendPromise.returns(Promise.reject(fakeError));
            await assert.isRejected(
                coinBase.queryExchangeRate('NA', targetCurrency),
                'No response received from CoinBase API'
            );
        });

        it('should fail if the request cannot be sent', async function() {
            const fakeError = {} as AxiosError;

            httpWrapperStub.sendPromise.returns(Promise.reject(fakeError));
            await assert.isRejected(
                coinBase.queryExchangeRate('NA', targetCurrency),
                'The request was not sent to the CoinBase API'
            );
        });
    });
});
