import { BaseElement } from './BaseElement.js';
import { supportsAdoptingStyleSheets, getShadowParentOrBody } from './util/DOMHelper.js';
import { globalStylesStore } from './util/GlobalStylesStore.js';

/**
 * Options object for the StyledElement
 * @typedef {Object} StyledElementOptions
 * @extends BaseElementOptions
 * @property {boolean} [shadowRender] - When set to true the element will render the template (if provided) in the Shadow DOM and therefore encapsulate the element and styles from the rest of the document. Default is `false`
 * @property {[]} [styles] - Via the styles option you can add multiple styles/stylesheets to your element. Default is `[]`
 * @property {boolean | string | string[]} [adoptGlobalStyles] - When set to true element-js will look for all style elements in the global document with and apply them before any custom/element styles inside the shadow DOM. Default is `true`.
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

        if (!this.constructor['elementStyleSheets']) {
            this.constructor['elementStyleSheets'] = this._styles.map((style) => {
                const cssStyleSheet = new CSSStyleSheet();
                cssStyleSheet.replaceSync(style);
                return cssStyleSheet;
            });
        }

        if (supportsAdoptingStyleSheets() && this._options.shadowRender) {
            // adopting does only make sense in shadow dom. Fall back to append for light elements
            this.adoptStyleSheets();

            if (this._options.adoptGlobalStyles !== false) {
                globalStylesStore.subscribe(() => {
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
     * Overrides the `update` method to adopt optional styles
     * @param {PropertyUpdateOptions} options
     */
    update(options) {
        // We cannot do this in connectedCallback() since the whole template will be overridden in update/render afterward
        if (!supportsAdoptingStyleSheets() || this._options.shadowRender === false) {
            this.appendStyleSheets();
        }
        super.update(options);
    }

    /**
     * Adopt stylesheets
     */
    adoptStyleSheets() {
        const adoptGlobalStyleSheets = this._options.shadowRender && this._options.adoptGlobalStyles !== false;

        this.getRoot().adoptedStyleSheets = [
            ...(adoptGlobalStyleSheets ? globalStylesStore.getGlobalStyleSheets(this._options.adoptGlobalStyles) : []),
            ...this.constructor['elementStyleSheets'],
        ];
    }

    /**
     * Custom polyfill for constructable stylesheets by appending styles to the end of an element
     */
    appendStyleSheets() {
        const parentDocument = getShadowParentOrBody(this.getRoot());

        const adoptGlobalStyleSheets =
            this._options.shadowRender &&
            this._options.adoptGlobalStyles !== false &&
            parentDocument !== globalThis.document.body;

        const appendableStyles = [
            ...(adoptGlobalStyleSheets ? globalStylesStore.getGlobalStyleSheets(this._options.adoptGlobalStyles) : []),
            ...this.constructor['elementStyleSheets'],
        ];

        appendableStyles.forEach((styleSheet, index) => {
            const identifier = this.tagName + index;

            // only append stylesheet if not already appended to shadowRoot or document
            if (!parentDocument.querySelector(`#${identifier}`)) {
                const styleElement = globalThis.document?.createElement('style');
                styleElement.id = identifier;
                styleElement.style.display = 'none';
                styleElement.textContent = Array.from(styleSheet.cssRules)
                    .map((rule) => rule.cssText)
                    .join('');
                parentDocument.appendChild(styleElement);
            }
        });
    }
}

export { StyledElement };
