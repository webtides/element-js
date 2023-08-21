/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { html, render } from '../../src/TemplateElement.js';
import { unsafeHTML } from '../../src/dom-parts/directives.js';
import { DOCUMENT_FRAGMENT_NODE, ELEMENT_NODE } from '../../src/util/DOMHelper.js';

describe('unsafeHTML directive', () => {
	it('returns a function', async () => {
		const unsafeContent = unsafeHTML(`<strong>Unsafe HTML</strong>`);
		assert.equal(typeof unsafeContent, 'function');
	});

	// it('returns a string as a result of the function in SSR', async () => {
	// 	const templateResult = html`<div>${unsafeHTML(`<strong>Unsafe HTML</strong>`)}</div>`;
	// 	assert.equal(typeof unsafeContent, 'string');
	// });

	it('returns a DocumentFragment as a result of the function CSR', async () => {
		const unsafeContent = unsafeHTML(`<strong>Unsafe HTML</strong>`);
		assert.equal(unsafeContent().nodeType, DOCUMENT_FRAGMENT_NODE);
	});

	it('can have one or multiple child nodes in CSR', async () => {
		const unsafeContent1 = unsafeHTML(`<strong>Unsafe HTML</strong>`);
		const unsafeContent2 = unsafeHTML(`<strong>Unsafe HTML 1</strong><strong>Unsafe HTML 2</strong>`);
		assert.equal(unsafeContent1().childElementCount, 1);
		assert.equal(unsafeContent2().childElementCount, 2);
		assert.equal(unsafeContent2().firstElementChild.innerHTML, 'Unsafe HTML 1');
		assert.equal(unsafeContent2().lastElementChild.innerHTML, 'Unsafe HTML 2');
	});
});
