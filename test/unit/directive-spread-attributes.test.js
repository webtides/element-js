/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { spreadAttributes } from '../../src/renderer/vanilla/util/directives.js';

describe('spreadAttributes directive', () => {
	it('maps primitive values to string attributes', async () => {
		const result = spreadAttributes({
			string: 'string',
			number: 13,
			boolean: true,
		});
		assert.equal(result(), "string='string' number='13' boolean='true'");
	});

	it('maps object like values to encoded and JSON parsable attributes', async () => {
		const result = spreadAttributes({
			list: [1, '2', 3],
			map: { foo: 'bar' },
		});
		assert.equal(result(), "list='[1,$quot;2$quot;,3]' map='{$quot;foo$quot;:$quot;bar$quot;}'");
	});

	it('converts camelCase names to dash-case', async () => {
		const result = spreadAttributes({
			camelToDash: 'automagically',
		});
		assert.equal(result(), "camel-to-dash='automagically'");
	});
});
