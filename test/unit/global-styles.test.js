/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, expect, html, nextFrame, fixtureSync } from '@open-wc/testing';
import { TemplateElement } from 'src/TemplateElement';
import { StyledElement } from 'src/StyledElement';

const color = 'rgb(255, 240, 0)';
const color2 = 'rgb(255, 0, 255)';
const shadowTag = defineCE(
	class extends TemplateElement {
		constructor() {
			super({ shadowRender: true });
		}

		styles() {
			return [`span {color: ${color2} }`];
		}

		template() {
			return html` <p ref="coloredP">red content</p>
				<span ref="coloredSpan"></span>`;
		}
	},
);

const shadowCascadeTag = defineCE(
	class extends TemplateElement {
		constructor() {
			super({ shadowRender: true });
		}

		styles() {
			return [`p {color: ${color2} }`];
		}

		template() {
			return html` <p ref="coloredP">red content</p> `;
		}
	},
);

const shadowNonAdoptingTag = defineCE(
	class extends TemplateElement {
		constructor() {
			super({ shadowRender: true, adoptGlobalStyles: false });
		}

		styles() {
			return [`span {color: ${color2} }`];
		}

		template() {
			return html` <p ref="coloredP">red content</p>
				<span ref="coloredSpan"></span>`;
		}
	},
);

const lightTag = defineCE(
	class extends TemplateElement {
		styles() {
			return [`span {color: ${color2} }`];
		}

		template() {
			return html` <p ref="coloredP">red content</p>
				<span ref="coloredSpan"></span>`;
		}
	},
);

describe('global-styles', () => {
	before(() => {
		const style = document.createElement('STYLE');
		style.type = 'text/css';
		style.id = 'globalStyles';
		style.appendChild(document.createTextNode(`p{color: ${color}}`));
		document.head.appendChild(style);
		StyledElement.updateGlobalStyles();
	});

	it('adopts globalStyles in lightDom', async () => {
		const el = await fixture(`<${lightTag}></${lightTag}>`);
		await nextFrame;
		const computedColor = await window.getComputedStyle(el.$refs.coloredP).getPropertyValue('color');
		assert.equal(computedColor, color);
		const computeSpanColor = await window.getComputedStyle(el.$refs.coloredSpan).getPropertyValue('color');
		assert.equal(computeSpanColor, color2);
	});

	it('adopts globalStyles in shadowDom', async () => {
		const el = await fixture(`<${shadowTag}></${shadowTag}>`);
		//this needs to be called to find the styles added ar runtime
		await nextFrame();
		const computedColor = await window.getComputedStyle(el.$refs.coloredP).getPropertyValue('color');
		assert.equal(computedColor, color);

		const computeSpanColor = await window.getComputedStyle(el.$refs.coloredSpan).getPropertyValue('color');
		assert.equal(computeSpanColor, color2);
	});

	it('does not adopt globalStyles in shadowDom if option is false', async () => {
		const el = await fixture(`<${shadowNonAdoptingTag}></${shadowNonAdoptingTag}>`);
		//this needs to be called to find the styles added ar runtime
		await nextFrame();
		const computedColor = await window.getComputedStyle(el.$refs.coloredP).getPropertyValue('color');
		assert.notEqual(computedColor, color);

		const computeSpanColor = await window.getComputedStyle(el.$refs.coloredSpan).getPropertyValue('color');
		assert.equal(computeSpanColor, color2);
	});

	it('adopty styles in correct order (shadow-dom)', async () => {
		const el = fixtureSync(`<${shadowCascadeTag}></${shadowCascadeTag}>`);
		await nextFrame();
		const computedColor = await window.getComputedStyle(el.$refs.coloredP).getPropertyValue('color');
		assert.equal(computedColor, color2);
	});

	after(() => {
		document.getElementById('globalStyles').remove();
	});
});
