import { StyledElement } from '../../StyledElement';
import { html, spreadAttributes, unsafeHTML } from './util/html';
import { render } from './util/render';
export { i18n } from '../../util/i18n';

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
		render(template, this.getRoot());
	}

	getRoot() {
		return this.shadowRoot !== null ? this.shadowRoot : this;
	}
}

export { TemplateElement, html, unsafeHTML, render, spreadAttributes };
