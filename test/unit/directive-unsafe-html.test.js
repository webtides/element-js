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

	it('returns a Node as a result of the function CSR', async () => {
		const unsafeContent = unsafeHTML(`<strong>Unsafe HTML</strong>`);
		assert.equal(unsafeContent().nodeType, ELEMENT_NODE);
	});
});