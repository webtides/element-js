/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { choose } from '../../src/dom-parts/directives.js';

describe('choose directive', () => {
    it('renders the matching key for the given value', async () => {
        const value = 'one';
        const result = choose(
            value,
            {
                one: 'I should be rendered',
                tow: 'I should NOT be rendered',
                three: 'I should also NOT be rendered',
            },
            'I should definitely NOT be rendered',
        );
        assert.equal(result, 'I should be rendered');
    });

    it('renders the defaultCase if the value has no match', async () => {
        const value = 'seven';
        const result = choose(
            value,
            {
                one: 'I should be rendered',
                tow: 'I should NOT be rendered',
                three: 'I should also NOT be rendered',
            },
            'I should definitely NOT be rendered',
        );
        assert.equal(result, 'I should definitely NOT be rendered');
    });

    it('renders noting when no defaultCase is given and the value has no match', async () => {
        const value = 'seven';
        const result = choose(value, {
            one: 'I should be rendered',
            tow: 'I should NOT be rendered',
            three: 'I should also NOT be rendered',
        });
        assert.equal(result, undefined);
    });
});
