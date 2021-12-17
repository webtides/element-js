/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';

const tag = defineCE(class extends BaseElement {});

describe('attributes-to-properties', () => {
	it('reflects lowercase attributes as lowercase properties', async () => {
		const el = await fixture(`<${tag} lowercase="Hello"></${tag}>`);
		assert.isTrue(el.hasOwnProperty('lowercase'));
		assert.equal(el.lowercase, 'Hello');
	});

	it('reflects camelCase attributes as lowercase properties', async () => {
		const el = await fixture(`<${tag} camelCase="Hello"></${tag}>`);
		assert.isNotTrue(el.hasOwnProperty('camelCase'));
		assert.isTrue(el.hasOwnProperty('camelcase'));
		assert.equal(el.camelcase, 'Hello');
	});

	it('reflects dash-case attributes as camelCase properties', async () => {
		const el = await fixture(`<${tag} dash-case="Hello"></${tag}>`);
		assert.isNotTrue(el.hasOwnProperty('dash-case'));
		assert.isTrue(el.hasOwnProperty('dashCase'));
		assert.equal(el.dashCase, 'Hello');
	});
});
