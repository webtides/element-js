/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { TemplateElement, html } from '../../src/TemplateElement';

const elementTag = defineCE(
	class extends TemplateElement {
		template() {
			return html`<p ref="unique">no content</p>
				<p ref="alsounique">no content</p>
				<p ref="notsounique">notuniqueSingle</p>
				<p ref="notsounique[]">notunique1</p>
				<p ref="notsounique[]">notunique2</p>`;
		}
	},
);

const preferLastRefExpression = defineCE(
	class extends TemplateElement {
		template() {
			return html`<p ref="unique">no content</p>
				<p ref="alsounique">no content</p>
				<p ref="notsounique[]">notunique1</p>
				<p ref="notsounique[]">notunique2</p>
				<p ref="notsounique">notuniqueSingle</p>`;
		}
	},
);

describe('ref-registration', () => {
	it('it registers a single ref at the components $refs map', async () => {
		const el = await fixture(`<${elementTag}></${elementTag}>`);
		await nextFrame();
		assert.exists(el.$refs.unique);
		assert.exists(el.$refs.alsounique);
	});

	it('it fails to register a single ref which is not within the template', async () => {
		const el = await fixture(`<${elementTag}></${elementTag}>`);
		assert.exists(el.$refs.unique);
		assert.notExists(el.$refs.foo);
	});

	it('it registers a explicitly marked ref as an array in the $refs map', async () => {
		const el = await fixture(`<${elementTag}></${elementTag}>`);
		assert.exists(el.$refs.notsounique);
		assert.equal(el.$refs.notsounique.length, 2);
		assert.isTrue(Array.prototype.isPrototypeOf(el.$refs.notsounique));
	});

	it('it prefers the last occuring ref expression in $refs map if its a [] expression', async () => {
		const el = await fixture(`<${elementTag}></${elementTag}>`);
		assert.exists(el.$refs.notsounique);
		assert.equal(el.$refs.notsounique.length, 2);
		assert.isTrue(Array.prototype.isPrototypeOf(el.$refs.notsounique));
	});

	it('it prefers the last occuring ref expression in $refs map if its a singular ref', async () => {
		const el = await fixture(`<${preferLastRefExpression}></${preferLastRefExpression}>`);
		assert.exists(el.$refs.notsounique);
		assert.isFalse(Array.prototype.isPrototypeOf(el.$refs.notsounique));
	});
});
