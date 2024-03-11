import { StyledElement } from './StyledElement.js';
import { html } from './dom-parts/html.js';
import { render } from './dom-parts/render.js';

/**
 * Options object for the TemplateElement
 * @typedef {Object} TemplateElementOptions
 * @extends StyledElementOptions
 */

class TemplateElement extends StyledElement {
	/**
	 * @param {TemplateElementOptions} options
	 */
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
	}

	/**
	 * Overrides the native `connectedCallback` of the HTMLElement to set up and initialize our element.
	 * This will attach a shadow DOM if the element is supposed to render in shadow DOM.
	 */
	connectedCallback() {
		if (this._options.shadowRender) this.attachShadow({ mode: 'open' });
		super.connectedCallback();
	}

	/**
	 * The template method should be overridden in extending elements and return the template to be rendered to the root
	 * @returns {TemplateResult|String}
	 */
	template() {
		return html``;
	}

	/**
	 * Override update method to render the template to the root
	 * @param {PropertyUpdateOptions} options
	 */
	update(options) {
		this.renderTemplate();
		super.update(options);
	}

	/**
	 * Render the template to the root
	 */
	renderTemplate() {
		const template = this._template || this.template();
		if (typeof template === 'string') {
			// just a plain string literal. no lit-html required
			this.getRoot().innerHTML = `${template}`;
		} else {
			render(template, this.getRoot());
		}
	}

	/**
	 * Get the root element - either the element or the shadow root
	 * @returns {ShadowRoot | HTMLElement}
	 */
	getRoot() {
		return this.shadowRoot !== null ? this.shadowRoot : this;
	}
}

export { TemplateElement, html, render };
