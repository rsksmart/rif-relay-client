import chai, { assert } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { SinonStub, stub } from 'sinon';
import * as fetchModule from 'node-fetch';
import { Response } from 'node-fetch';

import { CoinBase, CoinBaseResponse } from '../../src/api/CoinBase';

chai.use(chaiAsPromised);

describe('CoinBase', () => {
    let coinBase: CoinBase;
    const sourceCurrency = 'RIF';
    const targetCurrency = 'USD';
    const xRateRifUsd = '0.07770028890144696';
    let fakeResponse: Response;
    let fakeFetch: SinonStub;

    describe('query', () => {
        beforeEach(() => {
            const coinBaseResponse: CoinBaseResponse = {
                data: {
                    currency: sourceCurrency,
                    rates: {
                        USD: xRateRifUsd
                    }
                }
            };
            coinBase = new CoinBase();
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

        it('should return conversion', async () => {
            await assert.eventually.equal(
                coinBase.query(sourceCurrency, targetCurrency),
                xRateRifUsd,
                'Conversion is no the same'
            );
        });

        it('should fail if rate does not exist', async () => {
            await assert.isRejected(
                coinBase.query(sourceCurrency, 'NA'),
                `Exchange rate for currency pair ${sourceCurrency}/NA is not available`
            );
        });

        it('should fail if token/coin does not exist', async () => {
            fakeResponse = new Response(undefined, { status: 400 });
            fakeFetch.returns(Promise.resolve(fakeResponse));
            await assert.isRejected(
                coinBase.query('NA', targetCurrency),
                'Coinbase API does not recognise given currency NA'
            );
        });
    });
});
