/* eslint-disable no-unused-expressions */

import { fixture, fixtureSync, defineCE, assert, expect, nextFrame } from '@open-wc/testing';
import { TemplateElement, html } from '../../src/TemplateElement';
import { StyledElement } from '../../src/StyledElement';

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

const shadowCascadeTag = defineCE(
	class extends TemplateElement {
		constructor() {
			super({ shadowRender: true });
		}
		styles() {
			return [`p {color: ${color2} }`];
		}
		template() {
			return html` <p ref="coloredP">red content</p>`;
		}
	},
);

const lightCascadeTag = defineCE(
	class extends TemplateElement {
		styles() {
			return [`p {color: ${color2} }`];
		}
		template() {
			return html` <p ref="coloredP">red content</p>`;
		}
	},
);
describe('append-styles', () => {
	let cssReplace;

	before(() => {
		const style = document.createElement('STYLE');
		style.type = 'text/css';
		style.id = 'globalStyles';
		style.appendChild(document.createTextNode(`p{color: ${color}}`));
		document.head.appendChild(style);
		StyledElement.updateGlobalStyles();

		//convert chrome to firefox

		cssReplace = CSSStyleSheet.prototype.replace;
		delete CSSStyleSheet.prototype.replace;
	});

	it('appends stylesheets if the browser does not support adopting Styleheets (shadow-dom)', async () => {
		const el = fixtureSync(`<${shadowTag}></${shadowTag}>`);
		await nextFrame();
		const computedColor = await window.getComputedStyle(el.$refs.coloredP).getPropertyValue('color');
		const computeSpanColor = await window.getComputedStyle(el.$refs.coloredSpan).getPropertyValue('color');
		assert.equal(computedColor, color);
		assert.equal(computeSpanColor, color2);
	});

	it('appends stylesheets if the browser does not support adopting Styleheets (light-dom)', async () => {
		const el = fixtureSync(`<${lightTag}></${lightTag}>`);
		await nextFrame();
		const computedColor = await window.getComputedStyle(el.$refs.coloredP).getPropertyValue('color');
		const computeSpanColor = await window.getComputedStyle(el.$refs.coloredSpan).getPropertyValue('color');

		assert.equal(computedColor, color);
		assert.equal(computeSpanColor, color2);
	});

	it('appends styles in correct order (shadow-dom)', async () => {
		const el = fixtureSync(`<${shadowCascadeTag}></${shadowCascadeTag}>`);
		await nextFrame();
		const computedColor = await window.getComputedStyle(el.$refs.coloredP).getPropertyValue('color');
		assert.equal(computedColor, color2);
	});

	it('appends styles in correct order (light-dom)', async () => {
		const el = fixtureSync(`<${lightCascadeTag}></${lightCascadeTag}>`);
		await nextFrame();
		const computedColor = await window.getComputedStyle(el.$refs.coloredP).getPropertyValue('color');
		assert.equal(computedColor, color2);
	});

	after(() => {
		CSSStyleSheet.prototype.replace = cssReplace;
	});
});
