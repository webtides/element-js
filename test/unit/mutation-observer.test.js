/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, oneEvent, nextFrame } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';

class UpdateCountElement extends BaseElement {
	constructor(options) {
		super({ deferUpdate: false, ...options });
		this.updateCount = -1; // -1 because the first afterUpdate after the connected hook
	}

	afterUpdate() {
		this.updateCount++;
		if (this.updateCount > 0) {
			this.dispatch('afterUpdate', null);
		}
	}
}

const tag = defineCE(class extends UpdateCountElement {});

const subtreeObserverTag = defineCE(
	class extends UpdateCountElement {
		constructor() {
			super({ mutationObserverOptions: { subtree: true } });
		}
	},
);

describe('mutation-observer', () => {
	it('requests an update when an attribute is changed from outside', async () => {
		const el = await fixture(`<${tag} count="0"></${tag}>`);
		el.setAttribute('count', '1');
		await oneEvent(el, 'afterUpdate');
		assert.equal(el.getAttribute('count'), '1');
		assert.equal(el.count, 1);
	});

	it('does not request an update when an attribute is changed on child elements', async () => {
		const el = await fixture(`<${tag}><span id="change" count="0"></span></${tag}>`);
		const changeElement = el.querySelector('#change');
		changeElement.setAttribute('count', '1');
		await nextFrame();
		assert.equal(el.updateCount, 0);
	});

	it('can request an update when an attribute is changed on child elements by setting the "subtree" option in mutationObserverOptions to true', async () => {
		const el = await fixture(`<${subtreeObserverTag}><span id="change" count="0"></span></${subtreeObserverTag}>`);
		const changeElement = el.querySelector('#change');
		changeElement.setAttribute('count', '1');
		await oneEvent(el, 'afterUpdate');
		assert.equal(el.updateCount, 1);
	});

	it('requests an update when a child node has been added', async () => {
		const el = await fixture(`<${tag}></${tag}>`);
		el.innerHTML = `<span>i am nested</span>`;
		await oneEvent(el, 'afterUpdate');
		assert.equal(el.updateCount, 1);
	});

	it('does not request an update when a child node gets added to a child element', async () => {
		const el = await fixture(`<${tag}><span id="add"></span></${tag}>`);
		const addElement = el.querySelector('#add');
		addElement.innerHTML = `<span>i am nested</span>`;
		await nextFrame();
		assert.equal(el.updateCount, 0);
	});

	it('can request an update when a child node gets added to a child element by setting the "subtree" option in mutationObserverOptions to true', async () => {
		const el = await fixture(`<${subtreeObserverTag}><span id="add"></span></${subtreeObserverTag}>`);
		const addElement = el.querySelector('#add');
		addElement.innerHTML = `<span>i am nested</span>`;
		await oneEvent(el, 'afterUpdate');
		assert.equal(el.updateCount, 1);
	});

	it('requests an update when a child node has been removed', async () => {
		const el = await fixture(`<${tag}><span id="remove"></span></${tag}>`);
		el.removeChild(el.querySelector('#remove'));
		await oneEvent(el, 'afterUpdate');
		assert.equal(el.updateCount, 1);
	});
});
