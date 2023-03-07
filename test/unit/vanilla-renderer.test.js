import { defineCE } from '@open-wc/testing';
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

class UnsafeTag extends TemplateElement {
	properties() {
		return {
			count: 0,
		};
	}

	updateContent() {
		this.count += 1;
	}

	template() {
		return html`<div>${unsafeHTML(`<strong>unsafe content</strong>${this.count}`)}</div>`;
	}
}
customElements.define('unsafe-tag', UnsafeTag);

class ChildTag extends TemplateElement {
	properties() {
		return {
			text: '',
		};
	}

	template() {
		return html`${this.text}`;
	}
}
customElements.define('child-tag', ChildTag);

class SanitizedParentTag extends TemplateElement {
	template() {
		return html`<child-tag text="${'<strong>unsafe content</strong>'}"></child-tag>`;
	}
}
customElements.define('sanitized-parent-tag', SanitizedParentTag);

// TODO:
//testUnsafeHtml('vanilla', sanitizedTag, UnsafeTag, ChildTag, SanitizedParentTag);
