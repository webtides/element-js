import { StyledElement } from './StyledElement';
import { html, render } from 'lit-html';
export { i18n } from './util/i18n';
export { html, render } from 'lit-html';

class TemplateElement extends StyledElement {
	constructor(options) {
		super({
			deferUpdate: false,
			shadowRender: false,
			styles: [],
			adoptGlobalStyles: true,
			childListUpdate: false,
			...options,
		});
		this._template = this._options.template;
	}

	template() {
		return html``;
	}

	update() {
		this.renderTemplate();
		super.update();
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
		if (this._options.shadowRender && !this.shadowRoot) {
			this.attachShadow({ mode: 'open' });
		}
		return this.shadowRoot ?? this;
	}
}

export { TemplateElement };
