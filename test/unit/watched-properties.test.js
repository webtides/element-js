/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, oneEvent } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';

const tag = defineCE(
    class extends BaseElement {
        properties() {
            return {
                count: 0,
            };
        }

        watch() {
            return {
                count: (newValue, oldValue) => {
                    this.dispatch('count-changed', { newValue, oldValue });
                },
            };
        }
    },
);

describe('watched-properties', () => {
    it('watches property changes and invokes callback registered in watch map', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        setTimeout(() => (el.count = 1));
        await oneEvent(el, 'count-changed');
    });

    it('invokes watch callbacks with oldValue and newValue', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        setTimeout(() => (el.count = 1));
        const event = await oneEvent(el, 'count-changed');
        assert.equal(event.detail.oldValue, 0);
        assert.equal(event.detail.newValue, 1);
    });
});
