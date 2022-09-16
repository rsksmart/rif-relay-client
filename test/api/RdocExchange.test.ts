import { use, assert, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import RdocExchange from '../../src/api/RdocExchange';

use(chaiAsPromised);

describe('RdocExchange', () => {
    let rdocExchange: RdocExchange;
    const SOURCE_CURRENCY = 'RDOC';
    const TARGET_CURRENCY = 'USD';
    const X_RATE_RDOC_USD = '1';

    beforeEach(() => {
        rdocExchange = new RdocExchange();
    });

    describe('getApiTokenName', () => {
        it('should return mapped token name', () => {
            assert.equal(rdocExchange.getApiTokenName('RDOC'), SOURCE_CURRENCY);
        });

        it('should return mapped token(lowercase) name', () => {
            assert.equal(rdocExchange.getApiTokenName('rdoc'), SOURCE_CURRENCY);
        });

        it('should fail if token symbol is not mapped', () => {
            expect(() => rdocExchange.getApiTokenName('btc')).to.throw(
                'Token BTC is not internally mapped in RdocExchange API'
            );
        });

        it('should fail if token symbol is empty', () => {
            expect(() => rdocExchange.getApiTokenName('')).to.throw(
                'RdocExchange API cannot map a token with a null/empty value'
            );
        });
    });

    describe('queryExchangeRate', () => {
        it('Should return exchange rate RDOC/USD', async function () {
            expect(
                (
                    await rdocExchange.queryExchangeRate(
                        SOURCE_CURRENCY,
                        TARGET_CURRENCY
                    )
                ).toString()
            ).to.be.equal(X_RATE_RDOC_USD);
        });

        it('Should return exchange rate rdoc/usd', async function () {
            expect(
                (
                    await rdocExchange.queryExchangeRate(
                        SOURCE_CURRENCY.toLowerCase(),
                        TARGET_CURRENCY.toLowerCase()
                    )
                ).toString()
            ).to.be.equal(X_RATE_RDOC_USD);
        });

        it('should fail if rate does not exist', async () => {
            await expect(
                rdocExchange.queryExchangeRate(SOURCE_CURRENCY, 'NA')
            ).to.be.rejectedWith(
                `Exchange rate for currency pair ${SOURCE_CURRENCY} / NA is not available`
            );
        });
    });
});
