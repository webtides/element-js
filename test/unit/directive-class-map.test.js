/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { classMap } from '../../src/renderer/vanilla/util/directives.js';

describe('classMap directive', () => {
	it('maps a list of classes from an object to a string', async () => {
		const classes = classMap({
			active: true,
			number: 1,
			hidden: true,
		});
		assert.equal(classes, 'active number hidden');
	});

	it('omits classes if the given value is falsy', async () => {
		const classes = classMap({
			active: true,
			number: 1,
			hidden: false,
		});
		assert.equal(classes, 'active number');
	});
});
