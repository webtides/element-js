/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, expect, html, nextFrame } from '@open-wc/testing';
import { TemplateElement } from 'src/TemplateElement';
import { StyledElement } from 'src/StyledElement';

const shadowTag = defineCE(
	class extends TemplateElement {
		constructor() {
			super({ shadowRender: true });
		}

		template() {
			return html` <p ref="redP">red content</p> `;
		}
	},
);
const shadowNonAdoptingTag = defineCE(
	class extends TemplateElement {
		constructor() {
			super({ shadowRender: true, adoptGlobalStyles: false });
		}

		template() {
			return html` <p ref="redP">red content</p> `;
		}
	},
);

const lightTag = defineCE(
	class extends TemplateElement {
		template() {
			return html` <p ref="redP">light content</p> `;
		}
	},
);

describe('global-styles', () => {
	const color = 'rgb(255, 240, 0)';

	const style = document.createElement('STYLE');
	style.type = 'text/css';
	style.id = 'globalStyles';
	style.appendChild(document.createTextNode(`p{color: ${color}}`));
	document.head.appendChild(style);
	StyledElement.updateGlobalStyles();

	it('adopts globalStyles in lightDom', async () => {
		const el = await fixture(`<${lightTag}></${lightTag}>`);
		await nextFrame;
		const computedColor = await window.getComputedStyle(el.$refs.redP).getPropertyValue('color');
		assert.equal(computedColor, color);
	});

	it('adopts globalStyles in shadowDom', async () => {
		const el = await fixture(`<${shadowTag}></${shadowTag}>`);
		//this needs to be called to find the styles added ar runtime
		await nextFrame();
		const computedColor = await window.getComputedStyle(el.$refs.redP).getPropertyValue('color');
		assert.equal(computedColor, color);
	});

	it('does not adopt globalStyles in shadowDom if option is false', async () => {
		const el = await fixture(`<${shadowNonAdoptingTag}></${shadowNonAdoptingTag}>`);
		//this needs to be called to find the styles added ar runtime
		await nextFrame();
		const computedColor = await window.getComputedStyle(el.$refs.redP).getPropertyValue('color');
		assert.notEqual(computedColor, color);
	});
});
