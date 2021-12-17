/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, expect, nextFrame } from '@open-wc/testing';
import { TemplateElement, html } from '../../src/TemplateElement';
import { StyledElement } from '../../src/StyledElement';

const color = 'rgb(255, 240, 0)';
const shadowTag = defineCE(
	class extends TemplateElement {
		constructor() {
			super({ shadowRender: true });
		}

		styles() {
			return [`p {color: ${color};}`];
		}

		template() {
			return html` <p ref="coloredP">red content</p> `;
		}
	},
);

const lightTag = defineCE(
	class extends TemplateElement {
		styles() {
			return [`p {color: ${color};}`];
		}
		template() {
			return html` <p ref="coloredP">light content</p> `;
		}
	},
);

describe('element-styles', () => {
	it('adopts element styles in lightDom', async () => {
		const el = await fixture(`<${lightTag}></${lightTag}>`);
		await nextFrame();
		const computedColor = await window.getComputedStyle(el.$refs.coloredP).getPropertyValue('color');
		assert.equal(computedColor, color);
	});

	it('adopts element styles in shadowDom', async () => {
		const el = await fixture(`<${shadowTag}></${shadowTag}>`);
		//this needs to be called to find the styles added ar runtime
		await nextFrame();
		const computedColor = await window.getComputedStyle(el.$refs.coloredP).getPropertyValue('color');
		assert.equal(computedColor, color);
	});
});
