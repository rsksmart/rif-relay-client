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
    const fakeCoinBaseResponse: CoinBaseResponse = {
        data: {
            currency: input,
            rates: {
                USD: '0.07770028890144696'
            }
        }
    };
    let fakeResponse: Response;
    let fakeFetch: SinonStub;

    describe('query', () => {
        before(() => {
            coinBase = new CoinBase();
        });

        afterEach(() => {
            fakeFetch.restore();
        });

        it('should fail if rate does not exist', async () => {
            fakeResponse = new Response(JSON.stringify(fakeCoinBaseResponse), {
                status: 200
            });
            fakeFetch = stub(fetchModule, 'default').returns(
                Promise.resolve(fakeResponse)
            );
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
