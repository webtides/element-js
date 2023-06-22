import { StyledElement } from '../../StyledElement.js';
// import { html, render } from './template-parts-github';
import { html, render } from '@github/jtml';
// import { spreadAttributes, unsafeHTML } from './util/directives';
export { i18n } from '../../util/i18n.js';

class TemplateElement extends StyledElement {
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
			console.time('diff');
			render(template, this.getRoot());
			console.timeEnd('diff');
		}
	}

	getRoot() {
		return this.shadowRoot !== null ? this.shadowRoot : this;
	}
}

// export { TemplateElement, html, unsafeHTML, render, spreadAttributes };
export { TemplateElement, html, render };
