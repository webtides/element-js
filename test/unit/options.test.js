/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';
class ImmediateElement extends BaseElement {
	constructor() {
		super({ deferUpdate: false });
	}

	properties() {
		return {
			updateCalled: false,
			count: 0,
		};
	}

	update(options = { notify: true }) {
		this.updateCalled = true;
		super.update(options);
	}
}

const immediateTag = defineCE(ImmediateElement);

describe('options', () => {
	it('can disable initial rendering via attribute', async () => {
		const el = await fixture(`<${immediateTag} defer-update></${immediateTag}>`);
		assert.isFalse(el.updateCalled);
	});

	it('will update immediately if deferUpdate:true is passed via constructor options', async () => {
		const el = await fixture(`<${immediateTag}></${immediateTag}>`);
		assert.isTrue(el.updateCalled);
	});

	it('can defer initalization in connectedCallback via attribute', async () => {
		const el = await fixture(`<${immediateTag} defer-connected></${immediateTag}>`);
		// properties wil not be defined
		assert.isUndefined(el.updateCalled);
	});

	it('can initialize by calling connectedCallback manually', async () => {
		const el = await fixture(`<${immediateTag} defer-connected></${immediateTag}>`);
		el.connectedCallback();
		// properties wil be defined
		assert.isDefined(el.count);
		el.count++;
		await nextFrame();
		assert.isTrue(el.updateCalled);
	});

	it('can handle both defer-update and defer-connected on the same element', async () => {
		const el = await fixture(`<${immediateTag} defer-update defer-connected></${immediateTag}>`);
		el.connectedCallback();
		// properties wil be defined
		assert.isFalse(el.updateCalled);
		assert.isDefined(el.count);
		el.count++;
		await nextFrame();
		assert.isTrue(el.updateCalled);
	});
});
