import { BaseElement } from './BaseElement.js';
import { supportsAdoptingStyleSheets, getShadowParentOrBody } from './util/DOMHelper.js';

// TODO: add tests

/** @type {Map<Node, CSSStyleSheet>} */
const globalStyleSheetsCache = new WeakMap();

/**
 * @param {boolean | string | string[]} selector
 * @return {CSSStyleSheet[]}
 */
function getGlobalStyleSheets(selector) {
	const mutationObserver = new MutationObserver((mutationRecord) => {
		const filteredNodes = Array.from(mutationRecord[0].addedNodes).filter(
			(node) => node.tagName === 'STYLE' || node.tagName === 'LINK',
		);
		if (filteredNodes[0].tagName === 'LINK') {
			filteredNodes[0].onload = () => {
				globalThis.document?.dispatchEvent(new CustomEvent('global-styles-change'));
			};
		} else {
			globalThis.document?.dispatchEvent(new CustomEvent('global-styles-change'));
		}
	});
	mutationObserver.observe(globalThis.document, { subtree: true, childList: true });

	/** @type {CSSStyleSheet[]}*/
	const cssStyleSheets = [];

	if (selector === false) return cssStyleSheets;

	if (typeof selector === 'string') {
		selector = [selector];
	}

	if (selector === true || selector.includes('document')) {
		cssStyleSheets.push(...globalThis.document?.adoptedStyleSheets);
	}

	Array.from(globalThis.document?.styleSheets).map((styleSheet) => {
		if (Array.isArray(selector) && !selector.some((cssSelector) => styleSheet.ownerNode.matches(cssSelector))) {
			return;
		}

		let cssStyleSheet = globalStyleSheetsCache.get(styleSheet.ownerNode);
		if (!cssStyleSheet) {
			cssStyleSheet = new CSSStyleSheet();
			let cssText = '';
			if (styleSheet.ownerNode.tagName === 'STYLE') {
				cssText = styleSheet.ownerNode.textContent;
			} else if (styleSheet.ownerNode.tagName === 'LINK') {
				cssText = Array.from(styleSheet.cssRules)
					.map((rule) => rule.cssText)
					.join('');
			}
			cssStyleSheet.replaceSync(cssText);
		}
		cssStyleSheets.push(cssStyleSheet);
	});

	return cssStyleSheets;
}

/**
 * Options object for the StyledElement
 * @typedef {Object} StyledElementOptions
 * @extends BaseElementOptions
 * @property {boolean} [shadowRender] - When set to true the element will render the template (if provided) in the Shadow DOM and therefore encapsulate the element and styles from the rest of the document. Default is `false`
 * @property {[]} [styles] - Via the styles option you can add multiple styles/stylesheets to your element. Default is `[]`
 * @property {boolean} [adoptGlobalStyles] - When set to true element-js will look for a style element in the global document with an id of "globalStyles" and apply it before any custom/element styles inside the shadow DOM. Default is `true`
 */

class StyledElement extends BaseElement {
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

		if (!supportsAdoptingStyleSheets() || this._options.shadowRender === false) {
			this.appendStyleSheets();
		}

		if (supportsAdoptingStyleSheets() && this._options.shadowRender) {
			// adopting does only make sense in shadow dom. Fall back to append for light elements
			this.adoptStyleSheets();

			if (this._options.adoptGlobalStyles !== false) {
				globalThis.document?.addEventListener('global-styles-change', () => {
					this.adoptStyleSheets();
				});
			}
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
	 * Adopt stylesheets
	 */
	adoptStyleSheets() {
		if (!this.constructor['elementStyleSheets']) {
			this.constructor['elementStyleSheets'] = this._styles.map((style) => {
				const cssStyleSheet = new CSSStyleSheet();
				cssStyleSheet.replaceSync(style);
				return cssStyleSheet;
			});
		}

		const adoptGlobalStyleSheets = this._options.shadowRender && this._options.adoptGlobalStyles !== false;

		this.getRoot().adoptedStyleSheets = [
			...(adoptGlobalStyleSheets ? getGlobalStyleSheets(this._options.adoptGlobalStyles) : []),
			...this.constructor['elementStyleSheets'],
		];
	}

	/**
	 * Custom polyfill for constructable stylesheets by appending styles to the end of an element
	 */
	appendStyleSheets() {
		const parentDocument = getShadowParentOrBody(this.getRoot());
		this._styles.forEach((style, index) => {
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

export { StyledElement };
