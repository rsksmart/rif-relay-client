import { use, assert, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { createStubInstance, restore, SinonStubbedInstance } from 'sinon';
import { HttpWrapper } from '../../src';

import CoinBase, { CoinBaseResponse } from '../../src/api/CoinBase';

use(chaiAsPromised);

describe('CoinBase', () => {
    let coinBase: CoinBase;
    const sourceCurrency = 'RIF';
    const targetCurrency = 'USD';
    const xRateRifUsd = '0.07770028890144696';

    beforeEach(() => {
        coinBase = new CoinBase();
    });

    describe('constructor', function () {
        it('should set http wrapper', function () {
            const httpWrapper = new HttpWrapper();
            const localCoinBase = new CoinBase(httpWrapper) as unknown as {
                _httpWrapper: HttpWrapper;
            };

            expect(localCoinBase._httpWrapper).to.be.equals(httpWrapper);
        });

        it('should build url properly', function () {
            const url = 'https://api.coinbase.com';
            const path = '/v2/exchange-rates';
            const localCoinBase = new CoinBase(
                undefined,
                url,
                path
            ) as unknown as {
                _url: URL;
            };

            expect(localCoinBase._url.toString()).to.be.equal(url + path);
        });

        it('should fail if url cannot be build', function () {
            expect(() => new CoinBase(undefined, 'api.coinbase.com')).to.throw(
                'Invalid URL'
            );
        });
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

        it('should fail if token symbol is empty', () => {
            expect(() => coinBase.getApiTokenName('')).to.throw(
                'CoinBase API cannot map a token with a null/empty value'
            );
        });
    });

    describe('queryExchangeRate', () => {
        let httpWrapperStub: SinonStubbedInstance<HttpWrapper>;
        const coinBaseResponse: CoinBaseResponse = {
            data: {
                currency: sourceCurrency,
                rates: {
                    USD: xRateRifUsd
                }
            }
        };

        beforeEach(() => {
            httpWrapperStub = createStubInstance(HttpWrapper);
            (
                coinBase as unknown as { _httpWrapper: HttpWrapper }
            )._httpWrapper = httpWrapperStub;
        });

        afterEach(() => {
            restore();
        });

        it('should return exchange rate RIF/USD', async () => {
            httpWrapperStub.sendPromise.resolves(coinBaseResponse);
            await assert.eventually.equal(
                coinBase.queryExchangeRate(sourceCurrency, targetCurrency),
                xRateRifUsd,
                'Exchange rate is no the same'
            );
        });

        it('should return exchange rate rif/usd', async () => {
            httpWrapperStub.sendPromise.resolves(coinBaseResponse);
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
            httpWrapperStub.sendPromise.resolves(coinBaseResponse);
            await assert.isRejected(
                coinBase.queryExchangeRate(sourceCurrency, 'NA'),
                `Exchange rate for currency pair ${sourceCurrency}/NA is not available`
            );
        });

        it('should fail if API returns handled error message', async () => {
            const expectedStatus = 400;
            const fakeError = {
                response: {
                    status: expectedStatus
                }
            };

            httpWrapperStub.sendPromise.rejects(fakeError);
            await assert.isRejected(
                coinBase.queryExchangeRate('NA', targetCurrency),
                `CoinBase API status ${expectedStatus}`
            );
        });

        it("should fail if API doesn't return a response", async () => {
            const fakeError = {};

            httpWrapperStub.sendPromise.rejects(fakeError);
            await assert.isRejected(
                coinBase.queryExchangeRate('NA', targetCurrency),
                'No response received from CoinBase API'
            );
        });
    });
});
