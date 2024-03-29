import { defineCE } from '@open-wc/testing';
import { TemplateElement, html } from '../../src/TemplateElement.js';
import { unsafeHTML } from 'lit-html/directives/unsafe-html';
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

testTemplateBindings('lit', templateTag, html, unsafeHTML);

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

testTemplateRendering('lit', lightTag, shadowTag, deferTag, noHtmlTag);

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

//testUnsafeHtml('lit', sanitizedTag, unsafeTag, childTag, sanitizedParentTag);
