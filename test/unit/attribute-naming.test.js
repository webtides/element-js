/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';

const tag = defineCE(class extends BaseElement {});

describe('attribute-naming', () => {
	it('can have lowercase attributes', async () => {
		const el = await fixture(`<${tag} lowercase="1"></${tag}>`);
		assert.equal(el.getAttribute('lowercase'), '1');
	});

	it('cannot have camelCase attributes', async () => {
		const el = await fixture(`<${tag} camelCase="0"></${tag}>`);
		assert.isNotTrue(el.attributes.hasOwnProperty('camelCase'));
		assert.isTrue(el.attributes.hasOwnProperty('camelcase'));
	});

	it('can have dash-case attributes', async () => {
		const el = await fixture(`<${tag} dash-case="1"></${tag}>`);
		assert.equal(el.getAttribute('dash-case'), '1');
	});
});
