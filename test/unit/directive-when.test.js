/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { when } from '../../src/renderer/vanilla/util/directives.js';

describe('when directive', () => {
	it('renders the trueCase for a truthy value', async () => {
		const condition = true;
		const result = when(condition, 'I should be rendered', 'I should NOT be rendered');
		assert.equal(result, 'I should be rendered');
	});

	it('renders the falseCase for a falsy value', async () => {
		const condition = false;
		const result = when(condition, 'I should be rendered', 'I should NOT be rendered');
		assert.equal(result, 'I should NOT be rendered');
	});

	it('renders noting for a falsy value when no falseCase is given', async () => {
		const condition = false;
		const result = when(condition, 'I should be rendered');
		assert.equal(result, undefined);
	});
});
