import { assert, defineCE, fixture } from '@open-wc/testing';
import { TemplateElement, html } from '../../src/TemplateElement.js';
import { unsafeHTML } from '../../src/dom-parts/directives.js';
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

class NestedShadowDefaultTag extends NestedShadowTag {
	template() {
		return html`<slot>DEFAULT</slot>`;
	}
}
customElements.define('nested-shadow-default-tag', NestedShadowDefaultTag);

class SlottingParentTag extends TemplateElement {
	properties() {
		return {
			text: 'Foo',
		};
	}

	template() {
		return html` <nested-shadow-tag><div>${this.text}</div></nested-shadow-tag> `;
	}
}
customElements.define('slotting-parent-tag', SlottingParentTag);
class SlottingParentDefaultTag extends TemplateElement {
	template() {
		return html`<nested-shadow-default-tag></nested-shadow-default-tag> `;
	}
}
customElements.define('slotting-parent-default-tag', SlottingParentDefaultTag);
class SlottingParentNotDefaultTag extends TemplateElement {
	template() {
		return html`<nested-shadow-default-tag>NOT_DEFAULT</nested-shadow-default-tag> `;
	}
}
customElements.define('slotting-parent-not-default-tag', SlottingParentNotDefaultTag);

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

	it('should render default content in a slot', async () => {
		const defaultContent = '<slot>DEFAULT</slot>';
		const el = await fixture(`<nested-shadow-default-tag></nested-shadow-default-tag>`);
		await el.requestUpdate();
		assert.shadowDom.equal(el, defaultContent);
	});

	it('should be wider with default content than without', async () => {
		const el = await fixture(`<nested-shadow-tag></nested-shadow-tag>`);
		await el.requestUpdate();
		const defaultElement = await fixture(`<nested-shadow-default-tag></nested-shadow-default-tag>`);
		await defaultElement.requestUpdate();

		assert.isTrue(el.offsetWidth < defaultElement.offsetWidth);
	});
	it('should become wider with slotted content than with default', async () => {
		const defaultElement = await fixture(`<nested-shadow-default-tag></nested-shadow-default-tag>`);
		await defaultElement.requestUpdate();
		const otherElement = await fixture(`<nested-shadow-default-tag>NOT_DEFAULT</nested-shadow-default-tag>`);
		await otherElement.requestUpdate();

		assert.isTrue(defaultElement.offsetWidth < otherElement.offsetWidth);
	});

	it('should render default content even if rendered by another element', async () => {
		const defaultContent = '<slot>DEFAULT</slot>';
		const defaultElement = await fixture(`<nested-shadow-default-tag></nested-shadow-default-tag>`);
		await defaultElement.requestUpdate();

		const parentElement = await fixture(`<slotting-parent-default-tag></slotting-parent-default-tag>`);
		await parentElement.requestUpdate();
		const nested = parentElement.querySelector('nested-shadow-default-tag');
		await nested.requestUpdate();
		assert.equal(defaultElement.offsetWidth, nested.offsetWidth);
	});

	it('should render slotted content even if rendered by another element', async () => {
		const defaultElement = await fixture(`<nested-shadow-default-tag>NOT_DEFAULT</nested-shadow-default-tag>`);
		await defaultElement.requestUpdate();

		const parentElement = await fixture(`<slotting-parent-not-default-tag></slotting-parent-not-default-tag>`);
		await parentElement.requestUpdate();
		const nested = parentElement.querySelector('nested-shadow-default-tag');
		await nested.requestUpdate();
		assert.equal(defaultElement.offsetWidth, nested.offsetWidth);
	});
});
