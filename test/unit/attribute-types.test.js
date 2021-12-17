/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';

const tag = defineCE(class extends BaseElement {});

describe('attribute-types', () => {
	it('can have strings as attributes', async () => {
		const el = await fixture(`<${tag} string-value="Hello"></${tag}>`);
		assert.equal(el.getAttribute('string-value'), 'Hello');
	});

	it('can have numbers as attributes', async () => {
		const el = await fixture(`<${tag} number-value="1"></${tag}>`);
		assert.equal(el.getAttribute('number-value'), '1');
	});

	it('can have booleans as attributes', async () => {
		const el = await fixture(`<${tag} boolean-value="true"></${tag}>`);
		assert.equal(el.getAttribute('boolean-value'), 'true');
	});

	it('can have objects as attributes', async () => {
		const el = await fixture(`<${tag} object-value='{"foo":"bar"}'></${tag}>`);
		assert.equal(el.getAttribute('object-value'), '{"foo":"bar"}');
	});

	it('can have arrays as attributes', async () => {
		const el = await fixture(`<${tag} array-value='["one","two",3]'></${tag}>`);
		assert.equal(el.getAttribute('array-value'), '["one","two",3]');
	});
});
