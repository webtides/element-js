/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';

const tag = defineCE(class extends BaseElement {});

const propertyOptionsTag = defineCE(
	class extends BaseElement {
		constructor() {
			super({
				propertyOptions: {
					loaded: { reflect: true },
					unimportant: { reflect: false },
				},
			});
		}

		properties() {
			return {
				loaded: false,
			};
		}
	},
);

describe('attribute-reflection', () => {
	it('reflects string attributes correctly back as attributes from properties when changed', async () => {
		const el = await fixture(`<${tag} string-value='Hello'></${tag}>`);
		el.stringValue = 'Holla';
		await nextFrame();
		assert.equal(el.getAttribute('string-value'), 'Holla');
	});

	it('reflects number attributes correctly back as attributes from properties when changed', async () => {
		const el = await fixture(`<${tag} number-value='0'></${tag}>`);
		el.numberValue = 13;
		await nextFrame();
		assert.equal(el.getAttribute('number-value'), '13');
	});

	it('reflects boolean attributes correctly back as attributes from properties when changed', async () => {
		const el = await fixture(`<${tag} boolean-value='true'></${tag}>`);
		el.booleanValue = false;
		await nextFrame();
		assert.equal(el.getAttribute('boolean-value'), 'false');
	});

	it('reflects object attributes correctly back as attributes from properties when changed', async () => {
		const el = await fixture(`<${tag} object-value='{"foo":"bar"}'></${tag}>`);
		el.objectValue = { bar: 'foo' };
		await nextFrame();
		assert.equal(el.getAttribute('object-value'), '{"bar":"foo"}');
	});

	it('reflects array attributes correctly back as attributes from properties when changed', async () => {
		const el = await fixture(`<${tag} array-value='["one","two",3]'></${tag}>`);
		el.arrayValue = [1, 2, 3, 5, 8, 13, 20];
		await nextFrame();
		assert.equal(el.getAttribute('array-value'), '[1,2,3,5,8,13,20]');
	});

	it('reflects undefined properties back as empty "" attributes when changed', async () => {
		const el = await fixture(`<${tag} undefined-value='Hello'></${tag}>`);
		el.undefinedValue = undefined;
		await nextFrame();
		assert.notEqual(el.getAttribute('undefined-value'), 'undefined');
		assert.equal(el.getAttribute('undefined-value'), '');
	});

	it('reflects null properties back as empty "" attributes when changed', async () => {
		const el = await fixture(`<${tag} null-value='Hello'></${tag}>`);
		el.nullValue = null;
		await nextFrame();
		assert.notEqual(el.getAttribute('null-value'), 'null');
		assert.equal(el.getAttribute('null-value'), '');
	});

	it('reflects NaN properties back as empty "" attributes when changed', async () => {
		const el = await fixture(`<${tag} nan-value='Hello'></${tag}>`);
		el.nanValue = NaN;
		await nextFrame();
		assert.notEqual(el.getAttribute('nan-value'), 'NaN');
		assert.equal(el.getAttribute('nan-value'), '');
	});

	it('reflects properties as attributes when configured via propertyOptions', async () => {
		const el = await fixture(`<${propertyOptionsTag}></${propertyOptionsTag}>`);
		await nextFrame();
		assert.equal(el.hasAttribute('loaded'), true);
		assert.equal(el.getAttribute('loaded'), 'false');
	});

	it('removes attributes when configured to not reflect via propertyOptions', async () => {
		const el = await fixture(`<${propertyOptionsTag} unimportant="true"></${propertyOptionsTag}>`);
		await nextFrame();
		assert.equal(el.unimportant, true);
		assert.equal(el.hasAttribute('unimportant'), false);
	});
});
