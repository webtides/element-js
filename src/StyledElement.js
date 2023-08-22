import { BaseElement } from './BaseElement.js';
import { supportsAdoptingStyleSheets, getShadowParentOrBody } from './util/DOMHelper.js';
export { i18n } from './util/i18n.js';

/**
 * Options object for the StyledElement
 * @typedef {Object} StyledElementOptions
 * @extends BaseElementOptions
 * @property {boolean} [shadowRender] - When set to true the element will render the template (if provided) in the Shadow DOM and therefore encapsulate the element and styles from the rest of the document. Default is `false`
 * @property {[]} [styles] - Via the styles option you can add multiple styles/stylesheets to your element. Default is `[]`
 * @property {boolean} [adoptGlobalStyles] - When set to true element-js will look for a style element in the global document with an id of "globalStyles" and apply it before any custom/element styles inside the shadow DOM. Default is `true`
 */

class StyledElement extends BaseElement {
	static globalStyles = null;

	static updateGlobalStyles() {
		// this is a runtime dependency so that every shadow dom can make use of global css
		// we assume these styles to be inlined into the document
		StyledElement.globalStyles = globalThis.document?.getElementById('globalStyles');

		if (StyledElement.globalStyles && StyledElement['globalStyleSheet']) {
			//updates already adopted global styles
			StyledElement['globalStyleSheet'].replaceSync(StyledElement.globalStyles.textContent);
		}
	}

	/**
	 * @param {StyledElementOptions} options
	 */
	constructor(options) {
		super({
			deferUpdate: false,
			shadowRender: false,
			styles: [],
			adoptGlobalStyles: true,
			...options,
		});
		this._styles = [...this._options.styles, ...this.styles()];
	}

	/**
	 * Overrides the `connectedCallback` to adopt optional styles when the element is connected
	 */
	connectedCallback() {
		super.connectedCallback();

		if (supportsAdoptingStyleSheets() && this._options.shadowRender) {
			// adopting does only make sense in shadow dom. Fall back to append for light elements
			this.adoptStyleSheets();
		}
	}

	/**
	 * The styles method is another way to return a list of styles to be adopted when the element is connected.
	 * You can either provide a list in the constructor options or return it here.
	 * @returns {string[]}
	 */
	styles() {
		return [];
	}

	/**
	 * Overrides the `update` method to adopt optional styles
	 * @param {PropertyUpdateOptions} options
	 */
	update(options) {
		if (!supportsAdoptingStyleSheets() || this._options.shadowRender === false) {
			// append stylesheets to template if not already adopted
			const appendableStyles = [...this._styles];
			if (this._options.shadowRender && this._options.adoptGlobalStyles) {
				appendableStyles.unshift(StyledElement.globalStyles?.textContent ?? '');
			}
			this.appendStyleSheets(appendableStyles);
		}
		super.update(options);
	}

	/**
	 * Adopt stylesheets
	 */
	adoptStyleSheets() {
		if (!this.constructor['cssStyleSheets']) {
			this.constructor['cssStyleSheets'] = this._styles.map((style) => {
				const sheet = new CSSStyleSheet();
				if (sheet && sheet.cssRules.length === 0) {
					sheet.replaceSync(style);
				}
				return sheet;
			});
		}

		if (StyledElement.globalStyles && !StyledElement['globalStyleSheet']) {
			StyledElement['globalStyleSheet'] = new CSSStyleSheet();
			StyledElement['globalStyleSheet'].replaceSync(StyledElement.globalStyles.textContent);
		}

		// adopt styles
		// uses proposed solution for constructable stylesheets
		// see: https://wicg.github.io/construct-stylesheets/#proposed-solution
		this.getRoot().adoptedStyleSheets = [
			...(this._options.shadowRender && this._options.adoptGlobalStyles && StyledElement['globalStyleSheet']
				? [StyledElement['globalStyleSheet']]
				: []),
			...this.constructor['cssStyleSheets'],
		];
	}

	/**
	 * Custom polyfill for constructable stylesheets by appending styles to the end of an element
	 * @param {string[]} styles
	 */
	appendStyleSheets(styles) {
		const parentDocument = getShadowParentOrBody(this.getRoot());
		styles.forEach((style, index) => {
			const identifier = this.tagName + index;

			// only append stylesheet if not already appended to shadowRoot or document
			if (!parentDocument.querySelector(`#${identifier}`)) {
				const styleElement = globalThis.document?.createElement('style');
				styleElement.id = identifier;
				styleElement.style.display = 'none';
				styleElement.textContent = style;
				parentDocument.appendChild(styleElement);
			}
		});
	}
}

StyledElement.updateGlobalStyles();

export { StyledElement };
