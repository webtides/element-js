import { BaseElement } from './BaseElement.js';
import { supportsAdoptingStyleSheets, getShadowParentOrBody } from './util/DOMHelper.js';
export { i18n } from './util/i18n.js';

class StyledElement extends BaseElement {
	static globalStyles = null;

	static updateGlobalStyles() {
		// this is a runtime dependency so that every shadow dom can make use of global css
		// we assume these styles to be inlined into the document
		StyledElement.globalStyles = document.getElementById('globalStyles');

		if (StyledElement.globalStyles && StyledElement['globalStyleSheet']) {
			//updates already adopted global styles
			StyledElement['globalStyleSheet'].replaceSync(StyledElement.globalStyles.textContent);
		}
	}

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

	connectedCallback() {
		super.connectedCallback();

		if (supportsAdoptingStyleSheets() && this._options.shadowRender) {
			// adopting does only make sense in shadow dom. Fall back to append for light elements
			this.adoptStyleSheets();
		} else if (this._options.shadowRender && window.ShadyCSS !== undefined) {
			// if shadowRoot is polyfilled we use ShadyCSS to copy scoped styles to <head>
			window.ShadyCSS.ScopingShim.prepareAdoptedCssText(this._styles, this.localName);
		}

		// if shadowRoot is polyfilled - scope element template
		if (window.ShadyCSS !== undefined) {
			window.ShadyCSS.styleElement(this);
		}
	}

	styles() {
		return [];
	}

	update(options) {
		if (!supportsAdoptingStyleSheets() || this._options.shadowRender === false) {
			// append stylesheets to template if not already adopted
			const appendableStyles = [...this._styles];
			if (this._options.shadowRender && this._options.adoptGlobalStyles && !window.ShadyCSS) {
				appendableStyles.unshift(StyledElement.globalStyles?.textContent ?? '');
			}
			this.appendStyleSheets(appendableStyles);
		}
		super.update(options);
	}

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

	// custom polyfill for constructable stylesheets by appending styles to the end of an element
	appendStyleSheets(styles) {
		const parentDocument = getShadowParentOrBody(this.getRoot());
		styles.forEach((style, index) => {
			const identifier = this.tagName + index;

			// only append stylesheet if not already appended to shadowRoot or document
			if (!parentDocument.querySelector(`#${identifier}`)) {
				const styleElement = document.createElement('style');
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
