import { assert, expect } from 'chai';
import { getApiTokenName } from '../../src/api/Utils';

describe('Utils', () => {
    describe('getApiTokenName', () => {
        const api = 'Test';
        const currenyMapping: Record<string, string> = {
            RIF: 'RIF'
        };

        it('should return mapped token name', () => {
            assert.equal(getApiTokenName(api, 'RIF', currenyMapping), 'RIF');
        });

        it('should return mapped token(lowercase) name', () => {
            assert.equal(getApiTokenName(api, 'rif', currenyMapping), 'RIF');
        });

        it('should fail if token symbol is not mapped', () => {
            expect(() => getApiTokenName(api, 'RBTC', currenyMapping)).to.throw(
                `Token RBTC is not internally mapped in ${api} API`
            );
        });

        it('should fail if token symbol is null', () => {
            expect(() => getApiTokenName(api, null, currenyMapping)).to.throw(
                `${api} API cannot map a token with a null/empty value`
            );
        });

        it('should fail if token symbol is empty', () => {
            expect(() => getApiTokenName(api, '', currenyMapping)).to.throw(
                `${api} API cannot map a token with a null/empty value`
            );
        });
    });
});
