/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { i18n } from '../../src/util/i18n';
import { StyledElement } from '../../src/StyledElement';

describe('util/i18n', () => {
	it('will translate an existing key', async () => {
		window.elementjs = {
			i18n: () => ({ foo: 'bar' }),
		};

		const translation = i18n('foo');
		assert.equal(translation, 'bar');
	});

	it('will fallback to key if no translation ist specified', async () => {
		window.elementjs = {
			i18n: () => ({}),
		};
		const translation = i18n('key');
		assert.equal(translation, 'key');
	});

	it('will fallback to fallback if no translation ist specified and a fallback is passed', async () => {
		window.elementjs = {
			i18n: () => ({}),
		};
		const translation = i18n('key', 'fallback');
		assert.equal(translation, 'fallback');
	});

	it('will fallback to key if global i18n config is missing and no fallback is passed', async () => {
		window.elementjs = null;
		const translation = i18n('key');
		assert.equal(translation, 'key');
	});

	it('will fallback to fallback if global i18n config is missing and fallback is passed', async () => {
		window.elementjs = null;
		const translation = i18n('key', 'fallback');
		assert.equal(translation, 'fallback');
	});
});
