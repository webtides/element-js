/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';

const tag = defineCE(
	class extends BaseElement {
		properties() {
			return {
				count: 0,
			};
		}

		get nextCount() {
			return this.count + 1;
		}
	},
);

describe('computed-properties', () => {
	it('dynamically computes properties based on other properties', async () => {
		const el = await fixture(`<${tag}></${tag}>`);
		assert.equal(el.nextCount, 1);
		el.count = 2;
		await nextFrame();
		assert.equal(el.nextCount, 3);
	});
});
