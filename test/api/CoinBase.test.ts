import chai, { assert } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { SinonStub, stub } from 'sinon';
import * as fetchModule from 'node-fetch';
import { Response } from 'node-fetch';

import CoinBase from '../../src/api/CoinBase';
import { CoinBaseResponse } from '../../src/types/RelayPricer';

chai.use(chaiAsPromised);

describe('CoinBase', () => {
    let coinBase: CoinBase;
    const input = 'RIF';
    const output = 'USD';
    const USD_CONVERSION = '0.07770028890144696';
    const fakeCoinBaseResponse: CoinBaseResponse = {
        data: {
            currency: input,
            rates: {
                USD: USD_CONVERSION
            }
        }
    };
    let fakeResponse: Response;
    let fakeFetch: SinonStub;

    describe('query', () => {
        before(() => {
            coinBase = new CoinBase();
            fakeResponse = new Response(JSON.stringify(fakeCoinBaseResponse), {
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
                coinBase.query(input, output),
                USD_CONVERSION,
                'Conversion is no the same'
            );
        });

        it('should fail if rate does not exist', async () => {
            await assert.isRejected(
                coinBase.query(input, 'NA'),
                'Output not available'
            );
        });

        it('should fail if token/coin does not exist', async () => {
            fakeResponse = new Response(undefined, { status: 400 });
            fakeFetch = stub(fetchModule, 'default').returns(
                Promise.resolve(fakeResponse)
            );
            await assert.isRejected(
                coinBase.query('NA', output),
                'Input not available'
            );
        });
    });
});
