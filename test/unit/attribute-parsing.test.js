/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';

const tag = defineCE(class extends BaseElement {});

describe('attribute-parsing', () => {
	it('parses string attribute as string property', async () => {
		const el = await fixture(`<${tag} string-value="Hello"></${tag}>`);
		assert.equal(el.getAttribute('string-value'), 'Hello');
		assert.equal(el.stringValue, 'Hello');
	});

	it('parses numeric zero attribute as float property', async () => {
		const el = await fixture(`<${tag} number-value="0"></${tag}>`);
		assert.equal(el.getAttribute('number-value'), '0');
		assert.equal(el.numberValue, 0);
	});

	it('parses integer attribute as float property', async () => {
		const el = await fixture(`<${tag} number-value="33"></${tag}>`);
		assert.equal(el.getAttribute('number-value'), '33');
		assert.equal(el.numberValue, 33);
	});

	it('parses float attribute as float property', async () => {
		const el = await fixture(`<${tag} number-value="0.7"></${tag}>`);
		assert.equal(el.getAttribute('number-value'), '0.7');
		assert.equal(el.numberValue, 0.7);
	});

	it('parses negative number attribute as float property', async () => {
		const el = await fixture(`<${tag} number-value="-13"></${tag}>`);
		assert.equal(el.getAttribute('number-value'), '-13');
		assert.equal(el.numberValue, -13);
	});

	it('parses number attribute with more than one . as string property', async () => {
		const el = await fixture(`<${tag} number-value="127.0.0.1"></${tag}>`);
		assert.equal(el.getAttribute('number-value'), '127.0.0.1');
		assert.equal(el.numberValue, '127.0.0.1');
	});

	it('parses boolean attribute as boolean property', async () => {
		const el = await fixture(`<${tag} boolean-value="true"></${tag}>`);
		assert.equal(el.getAttribute('boolean-value'), 'true');
		assert.equal(el.booleanValue, true);
	});

	it('parses object attribute as object property', async () => {
		const el = await fixture(`<${tag} object-value='{"foo":"bar"}'></${tag}>`);
		assert.equal(el.getAttribute('object-value'), '{"foo":"bar"}');
		assert.deepEqual(el.objectValue, { foo: 'bar' });
	});

	it('parses array attribute as array property', async () => {
		const el = await fixture(`<${tag} array-value='["one","two",3]'></${tag}>`);
		assert.equal(el.getAttribute('array-value'), '["one","two",3]');
		assert.deepEqual(el.arrayValue, ['one', 'two', 3]);
	});
});
