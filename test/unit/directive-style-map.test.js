/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { styleMap } from '../../src/renderer/vanilla/util/directives.js';

describe('styleMap directive', () => {
	it('maps a list of styles from an object to a string', async () => {
		const isBlue = true;
		const style = styleMap({
			'background-color': isBlue ? 'blue' : 'gray',
			color: 'white',
		});
		assert.equal(style, 'background-color:blue; color:white;');
	});
});
