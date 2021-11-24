import { StyledElement } from './StyledElement';
import { html } from 'lit-html';
import { render } from 'lit-html/lib/shady-render';
export { i18n } from './util/i18n';

class LitTemplateElement extends StyledElement {
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

		if (this._options.shadowRender) this.attachShadow({ mode: 'open' });
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
			// just a plain string literal. no lit-html required
			this.getRoot().innerHTML = `${template}`;
		} else {
			// render via lit-html
			render(html` ${template} `, this.getRoot(), {
				scopeName: this.localName,
				eventContext: this,
			});
		}
	}

	getRoot() {
		return this.shadowRoot !== null ? this.shadowRoot : this;
	}
}

export { LitTemplateElement, html, render };
