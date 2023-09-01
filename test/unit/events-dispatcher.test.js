/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, oneEvent } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';

const tag = defineCE(
	class extends BaseElement {
		fireEvent() {
			this.dispatch('custom-event', { name: 'Hello' });
		}

		fireEventWithCustomOptions() {
			this.dispatch('custom-event', 'foo', { bubbles: false, detail: 'bar' });
		}

		fireEventWithOldSyntax() {
			this.dispatch('custom-event', 'foo', true, false, true);
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

	it('will have all custom event options set to true by default', async () => {
		const el = await fixture(`<${tag}></${tag}>`);
		setTimeout(() => el.fireEvent());
		const event = await oneEvent(el, 'custom-event');
		assert.equal(event.bubbles, true);
		assert.equal(event.cancelable, true);
		assert.equal(event.composed, true);
	});

	it('can override custom event options', async () => {
		const el = await fixture(`<${tag}></${tag}>`);
		setTimeout(() => el.fireEventWithCustomOptions());
		const event = await oneEvent(el, 'custom-event');
		assert.equal(event.bubbles, false);
		assert.equal(event.cancelable, true);
		assert.equal(event.composed, true);
		assert.equal(event.detail, 'bar');
	});

	it('can have custom event options with the old deprecated syntax', async () => {
		const el = await fixture(`<${tag}></${tag}>`);
		setTimeout(() => el.fireEventWithOldSyntax());
		const event = await oneEvent(el, 'custom-event');
		assert.equal(event.bubbles, true);
		assert.equal(event.cancelable, false);
		assert.equal(event.composed, true);
		assert.equal(event.detail, 'foo');
	});
});
