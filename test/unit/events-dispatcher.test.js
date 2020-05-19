/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, oneEvent } from '@open-wc/testing';
import { BaseElement } from 'src/BaseElement';

const tag = defineCE(
    class extends BaseElement {
        fireEvent() {
            this.dispatch('custom-event', { name: 'Hello' });
        }
    },
);

describe('events-dispatcher', () => {
    it('can dispatch custom events', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        setTimeout(() => el.fireEvent());
        const event = await oneEvent(el, 'custom-event');
        assert.deepEqual(event.detail, { name: 'Hello' });
    });
});
