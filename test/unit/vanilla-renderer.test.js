import { assert, defineCE, fixture } from '@open-wc/testing';
import { TemplateElement, html, unsafeHTML } from '../../src/renderer/vanilla/TemplateElement.js';
import { testTemplateBindings } from './renderer/template-bindings.js';
import { testTemplateRendering } from './renderer/template-rendering.js';

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

class NestedShadowTag extends TemplateElement {
	constructor() {
		super({ shadowRender: true });
	}

	template() {
		return html`<slot></slot>`;
	}
}
customElements.define('nested-shadow-tag', NestedShadowTag);

class SlottingParentTag extends TemplateElement {
	properties() {
		return {
			text: 'Foo',
		};
	}

	template() {
		return html`<nested-shadow-tag><div>${this.text}</div></nested-shadow-tag>`;
	}
}
customElements.define('slotting-parent-tag', SlottingParentTag);

class NestedLightTag extends TemplateElement {
	template() {
		return html`<div>Foo</div>`;
	}
}
customElements.define('nested-light-tag', NestedLightTag);

class NestingParentTag extends TemplateElement {
	properties() {
		return {
			text: 'Bar',
		};
	}

	template() {
		return html`<nested-light-tag><div>${this.text}</div></nested-light-tag>`;
	}
}
customElements.define('nesting-parent-tag', NestingParentTag);

describe(`vanilla-renderer`, () => {
	it('can re-render/update slotted templates', async () => {
		const el = await fixture(`<slotting-parent-tag></slotting-parent-tag>`);
		assert.lightDom.equal(el, `<nested-shadow-tag><div>Foo</div></nested-shadow-tag>`);
		el.text = 'Bar';
		await el.requestUpdate();
		assert.lightDom.equal(el, `<nested-shadow-tag><div>Bar</div></nested-shadow-tag>`);
	});

	it('should not re-render/update nested templates', async () => {
		const el = await fixture(`<nesting-parent-tag></nesting-parent-tag>`);
		assert.lightDom.equal(el, `<nested-light-tag><div>Bar</div></nested-light-tag>`);
		await el.requestUpdate();
		assert.lightDom.equal(el, `<nested-light-tag><div>Foo</div></nested-light-tag>`);
		el.text = 'Baz';
		await el.requestUpdate();
		assert.lightDom.equal(el, `<nested-light-tag><div>Foo</div></nested-light-tag>`);
	});
});
