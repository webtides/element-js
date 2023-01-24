import { assert, defineCE, fixture } from '@open-wc/testing';
import { TemplateElement, html, unsafeHTML } from '../../src/renderer/vanilla/TemplateElement.js';
import { testTemplateBindings } from './renderer/template-bindings.js';
import { testTemplateRendering } from './renderer/template-rendering.js';
import { testUnsafeHtml } from './renderer/unsafe-html.js';

const templateTag = defineCE(
	class extends TemplateElement {
		async updateTemplate(template) {
			this._template = template;
			await this.requestUpdate();
		}
	},
);

testTemplateBindings('vanilla', templateTag, html, unsafeHTML);

const lightTag = defineCE(
	class extends TemplateElement {
		template() {
			return html` <div>light content</div> `;
		}
	},
);

const shadowTag = defineCE(
	class extends TemplateElement {
		constructor() {
			super({ shadowRender: true });
		}

		template() {
			return html` <div>shadow content</div> `;
		}
	},
);

const deferTag = defineCE(
	class extends TemplateElement {
		constructor() {
			super({ deferUpdate: true });
		}

		template() {
			return html` <div>deferred content</div> `;
		}
	},
);

const noHtmlTag = defineCE(
	class extends TemplateElement {
		template() {
			return `<div>no html template result content</div>`;
		}
	},
);

testTemplateRendering('vanilla', lightTag, shadowTag, deferTag, noHtmlTag);

const sanitizedTag = defineCE(
	class extends TemplateElement {
		template() {
			return html` <div>${'<strong>unsafe content</strong>'}</div> `;
		}
	},
);

const unsafeTag = defineCE(
	class extends TemplateElement {
		properties() {
			return {
				count: 0,
			};
		}

		updateContent() {
			this.count += 1;
		}

		template() {
			return html` <div>${unsafeHTML(`<strong>unsafe content</strong>${this.count}`)}</div> `;
		}
	},
);

const childTag = defineCE(
	class extends TemplateElement {
		properties() {
			return {
				text: '',
			};
		}

		template() {
			return html`${this.text}`;
		}
	},
);

const sanitizedParentTag = defineCE(
	class extends TemplateElement {
		template() {
			return html`<${childTag} text="${'<strong>unsafe content</strong>'}"></${childTag}>`;
		}
	},
);

testUnsafeHtml('vanilla', sanitizedTag, unsafeTag, childTag, sanitizedParentTag);

const nestedShadowTag = defineCE(
	class extends TemplateElement {
		constructor() {
			super({ shadowRender: true });
		}

		template() {
			return html`<slot></slot>`;
		}
	},
);

const slottingParentTag = defineCE(
	class extends TemplateElement {
		properties() {
			return {
				text: 'Foo',
			};
		}

		template() {
			return html`<${nestedShadowTag}><div>${this.text}</div></${nestedShadowTag}>`;
		}
	},
);

const nestedLightTag = defineCE(
	class extends TemplateElement {
		template() {
			return html`<div>Foo</div>`;
		}
	},
);

const nestingParentTag = defineCE(
	class extends TemplateElement {
		properties() {
			return {
				text: 'Bar',
			};
		}

		template() {
			return html`<${nestedLightTag}><div>${this.text}</div></${nestedShadowTag}>`;
		}
	},
);

describe(`vanilla-renderer`, () => {
	it('can re-render/update slotted templates', async () => {
		const el = await fixture(`<${slottingParentTag}></${slottingParentTag}>`);
		assert.lightDom.equal(el, `<${nestedShadowTag}><div>Foo</div></${nestedShadowTag}>`);
		el.text = 'Bar';
		await el.requestUpdate();
		assert.lightDom.equal(el, `<${nestedShadowTag}><div>Bar</div></${nestedShadowTag}>`);
	});

	it('should not re-render/update nested templates', async () => {
		const el = await fixture(`<${nestingParentTag}></${slottingParentTag}>`);
		assert.lightDom.equal(el, `<${nestedLightTag}><div>Bar</div></${nestedShadowTag}>`);
		await el.requestUpdate();
		assert.lightDom.equal(el, `<${nestedLightTag}><div>Foo</div></${nestedShadowTag}>`);
		el.text = 'Baz';
		await el.requestUpdate();
		assert.lightDom.equal(el, `<${nestedLightTag}><div>Foo</div></${nestedShadowTag}>`);
	});
});
