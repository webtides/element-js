/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, nextFrame, oneEvent } from '@open-wc/testing';
import { BaseElement } from 'src/BaseElement';

const tag = defineCE(
	class extends BaseElement {
		constructor() {
			super({ deferUpdate: false });
			this.updateCount = 0;
		}

		afterUpdate() {
			this.dispatch('afterUpdate', null, true);
		}

		registerEventsAndRefs() {
			this.updateCount++;
			super.registerEventsAndRefs();
		}
	},
);

describe('child-list-mutation', () => {
	it('re-registers events and refs after a child node has been added', async () => {
		const el = await fixture(`<${tag}></${tag}>`);
		el.updateCount = 0;
		el.innerHTML = `<span>i am nested</span>`;
		await oneEvent(el, 'afterUpdate');
		assert.equal(el.updateCount, 1);
	});
	it('re-registers events and refs after a child node has been removed', async () => {
		const el = await fixture(`<${tag}><span id="remove"></span></${tag}>`);
		el.updateCount = 0;
		el.removeChild(el.querySelector('#remove'));
		await oneEvent(el, 'afterUpdate');
		assert.equal(el.updateCount, 1);
	});
});
