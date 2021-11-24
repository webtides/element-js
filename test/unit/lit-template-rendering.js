/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { html, LitTemplateElement } from 'src/LitTemplateElement';

const lightTag = defineCE(
	class extends LitTemplateElement {
		template() {
			return html` <div>light content</div> `;
		}
	},
);

const shadowTag = defineCE(
	class extends LitTemplateElement {
		constructor() {
			super({ shadowRender: true });
		}

		template() {
			return html` <div>shadow content</div> `;
		}
	},
);

const deferTag = defineCE(
	class extends LitTemplateElement {
		constructor() {
			super({ deferUpdate: true });
		}

		template() {
			return html` <div>deferred content</div> `;
		}
	},
);

const noHtmlTag = defineCE(
	class extends LitTemplateElement {
		template() {
			return `<div>no html template result content</div>`;
		}
	},
);

const encodedHtmlTag = defineCE(
	class extends LitTemplateElement {
		template() {
			return html`${'<div>dangerous html</div>'}`;
		}
	},
);

describe('simple template-rendering', () => {
	it('renders template in light dom by default', async () => {
		const el = await fixture(`<${lightTag}></${lightTag}>`);
		assert.isNull(el.shadowRoot);
		assert.lightDom.equal(el, '<div>light content</div>');
	});

	it('can render template in shadow dom by setting shadowRender: true via constructor options', async () => {
		const el = await fixture(`<${shadowTag}></${shadowTag}>`);
		assert.isNotNull(el.shadowRoot);
		assert.shadowDom.equal(el, '<div>shadow content</div>');
	});

	it('can defer rendering template by setting deferUpdate: true via constructor options', async () => {
		const el = await fixture(`<${deferTag}></${deferTag}>`);
		assert.equal(el.innerHTML.trim(), '');
		assert.lightDom.equal(el, '');
		await el.requestUpdate();
		assert.lightDom.equal(el, '<div>deferred content</div>');
	});

	it('can render standard strings as template instead of html template results', async () => {
		const el = await fixture(`<${noHtmlTag}></${noHtmlTag}>`);
		assert.lightDom.equal(el, '<div>no html template result content</div>');
	});

	it('can encode potentially dangerous html', async () => {
		const el = await fixture(`<${encodedHtmlTag}></${encodedHtmlTag}>`);
		assert.lightDom.equal(el, `&lt;div&gt;dangerous html&lt;/div&gt;`);
	});
});
