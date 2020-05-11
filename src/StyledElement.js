import { BaseElement } from './BaseElement';
import { supportsAdoptingStyleSheets, getShadowParentOrBody } from './util/DOMHelper';
export { i18n } from './util/i18n';

// this is a runtime dependency so that every shadow dom can use utility css classes
// alternatively we could load ../../css/inline.css here via import and parse it through rollup
// that would change it to a compile time dependency but would also load the css twice
// because it is already injected into the <head>
const globalStyles = document.getElementById('globalStyles');
const globalStylesTextContent = globalStyles !== null ? globalStyles.textContent : '';

class StyledElement extends BaseElement {
	constructor(options) {
		super({
			deferUpdate: false,
			shadowRender: true,
			styles: [],
			adoptGlobalStyles: true,
			childListUpdate: false,
			...options,
		});
		this._styles = [...this._options.styles, ...this.styles()];

		this._hasGlobalStyles = this._options.adoptGlobalStyles && globalStyles !== null;

		if (this._options.shadowRender && supportsAdoptingStyleSheets) {
			this.prepareAndAdoptStyleSheets();
		}
	}

	connectedCallback() {
		super.connectedCallback();

		if (!this.constructor['_hasAdoptedStylesheets']) {
			// Only actually parse the stylesheet when the first instance is connected.
			this.parseStyleSheets();
		}
	}

	styles() {
		return [];
	}

	update() {
		// append styles if not already adopted
		if (this._options.shadowRender && !supportsAdoptingStyleSheets) {
			this.appendStyleSheets(this.collectStyles());
		} else if (this._options.shadowRender === false) {
			// in light dom we don't need to append the global stylesheets since they are already there
			this.appendStyleSheets(this.collectStyles(false));
		}

		super.update();
	}

	prepareAndAdoptStyleSheets() {
		if (this._hasGlobalStyles && !StyledElement['globalCssStyleSheets']) {
			StyledElement['globalCssStyleSheets'] = new CSSStyleSheet();
		}

		if (!this.constructor['cssStyleSheets']) {
			this.constructor['cssStyleSheets'] = this._styles.map(() => new CSSStyleSheet());
		}

		// adopt styles
		// uses proposed solution for constructable stylesheets
		// see: https://wicg.github.io/construct-stylesheets/#proposed-solution
		this.getRoot().adoptedStyleSheets = this.collectStyleSheets();
	}

	parseStyleSheets() {
		if (this._hasGlobalStyles) {
			const sheet = StyledElement['globalCssStyleSheets'];
			if (sheet && sheet.cssRules.length === 0) {
				sheet.replaceSync(globalStylesTextContent);
			}
		}

		this._styles.forEach((style, index) => {
			const sheet = this.constructor['cssStyleSheets'] ? this.constructor['cssStyleSheets'][index] : null;
			if (sheet && sheet.cssRules.length === 0) {
				sheet.replaceSync(style);
			}
		});

		this.constructor['_hasAdoptedStylesheets'] = true;
	}

	collectStyleSheets() {
		const styleSheets = [];

		if (this._hasGlobalStyles) styleSheets.push(StyledElement['globalCssStyleSheets']);

		return [...styleSheets, ...this.constructor['cssStyleSheets']];
	}

	collectStyles(hasGlobalStyles = this._hasGlobalStyles) {
		const styles = [];

		if (hasGlobalStyles) styles.push(globalStylesTextContent);

		return [...styles, ...this._styles];
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

export { StyledElement };
