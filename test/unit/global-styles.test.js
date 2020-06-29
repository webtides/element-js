/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, expect, html, nextFrame } from '@open-wc/testing';
import { TemplateElement } from 'src/TemplateElement';

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

	it('adopts globalStyles in lightDom', async () => {
		const el = await fixture(`<${lightTag}></${lightTag}>`);
		await el.requestUpdate();
		assert.isNull(el.shadowRoot);
		const computedColor = await window.getComputedStyle(el.$refs.redP).getPropertyValue('color');
		assert(computedColor === color);
	});

	it('adopts globalStyles in shadowDom', async () => {
		const el = await fixture(`<${shadowTag}></${shadowTag}>`);

		el._hasGlobalStyles = true;
		el.updateGlobalStyles();
		el.prepareAndAdoptStyleSheets();
		el.parseStyleSheets();
		await el.requestUpdate();
		assert.isNotNull(el.shadowRoot);
		const computedColor = await window.getComputedStyle(el.$refs.redP).getPropertyValue('color');
		assert(computedColor === color);
	});
});
