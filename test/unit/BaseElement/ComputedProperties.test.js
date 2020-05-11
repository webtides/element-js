/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { BaseElement } from '../../../src/BaseElement';

const tag = defineCE(
    class extends BaseElement {
        properties() {
            return {
                count: 0,
            };
        }

        computed() {
            return {
                nextCount: () => {
                    return this.count + 1;
                },
            };
        }
    },
);

describe('ComputedProperties', () => {
    it('dynamically computes properties based on other properties', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        assert.equal(el.nextCount, 1);
        el.count = 2;
        assert.equal(el.nextCount, 3);
    });
});
