import { StyledElement } from '../../StyledElement.js';
import { html, spreadAttributes, unsafeHTML } from './util/html.js';
import { render } from './util/render.js';
export { i18n } from '../../util/i18n.js';

class TemplateElement extends StyledElement {
	static _$templateElement$ = true;

	constructor(options) {
		super({
			deferUpdate: false,
			shadowRender: false,
			styles: [],
			adoptGlobalStyles: true,
			mutationObserverOptions: {
				childList: false,
			},
			...options,
		});
		this._template = this._options.template;

		if (this._options.shadowRender && !this.shadowRoot) {
			this.attachShadow({ mode: 'open' });
		}
	}

	template() {
		return html``;
	}

	update(options) {
		this.renderTemplate();
		super.update(options);
	}

	renderTemplate() {
		const template = this._template || this.template();

		if (typeof template === 'string') {
			// just a plain string literal. no fancy rendering required
			this.getRoot().innerHTML = `${template}`;
		} else {
			render(template, this.getRoot());
		}
	}

	getRoot() {
		return this.shadowRoot !== null ? this.shadowRoot : this;
	}
}

export { TemplateElement, html, unsafeHTML, render, spreadAttributes };
