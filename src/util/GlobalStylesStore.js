import { Store } from './Store.js';

/**
 * @property {CSSStyleSheet[]} cssStyleSheets
 */
class GlobalStylesStore extends Store {
    /** @type {WeakMap<Node, CSSStyleSheet>} */
    globalStyleSheetsCache = new WeakMap();

    constructor() {
        super();
        this.createGlobalStyleSheetsCache();
        if (globalThis.elementJsConfig?.observeGlobalStyles) {
            this.initMutationObserver();
        }
    }

    initMutationObserver() {
        const mutationObserver = new MutationObserver(async (mutationRecord) => {
            if (!mutationRecord[0]) return;

            const filteredNodes = Array.from(mutationRecord[0].addedNodes).filter(
                (node) => node.tagName === 'STYLE' || node.tagName === 'LINK',
            );

            filteredNodes.forEach((styleNode) => {
                if (styleNode.tagName === 'LINK') {
                    if (styleNode.sheet) {
                        // already loaded
                        this.processStylesheet(styleNode.sheet);
                    } else {
                        // wait for download
                        styleNode.onload = () => {
                            this.processStylesheet(styleNode.sheet);
                        };
                    }
                } else if (styleNode.tagName === 'STYLE') {
                    this.processStylesheet(styleNode.sheet);
                }
            });
        });
        mutationObserver.observe(globalThis.document, { subtree: true, childList: true });
    }

    createGlobalStyleSheetsCache() {
        Array.from(globalThis.document?.styleSheets).map((styleSheet) => this.processStylesheet(styleSheet));
    }

    processStylesheet(styleSheet) {
        let cssStyleSheet = this.globalStyleSheetsCache.get(styleSheet.ownerNode);

        if (cssStyleSheet) {
            return;
        }

        // if it does not exist yet -> build it
        if (styleSheet.ownerNode.tagName === 'STYLE') {
            const cssStyleSheet = new CSSStyleSheet({ media: styleSheet.media, disabled: styleSheet.disabled });
            cssStyleSheet.replaceSync(styleSheet.ownerNode.textContent);

            this.globalStyleSheetsCache.set(styleSheet.ownerNode, cssStyleSheet);
            this.requestUpdate();
        } else if (styleSheet.ownerNode.tagName === 'LINK') {
            const cssStyleSheet = new CSSStyleSheet({
                baseURL: styleSheet.href,
                media: styleSheet.media,
                disabled: styleSheet.disabled,
            });
            try {
                Array.from(styleSheet?.cssRules ?? []).map((rule, index) =>
                    cssStyleSheet.insertRule(rule.cssText, index),
                );

                this.globalStyleSheetsCache.set(styleSheet.ownerNode, cssStyleSheet);

                this.requestUpdate();
                // update observer that there might be new styles to adopt
            } catch (e) {
                console.error(
                    'GlobalStylesStore: cannot read cssRules. Maybe add crossorigin="anonymous" to your style link?',
                    e,
                );
            }
        }
    }

    getGlobalStyleSheets(selector) {
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

            let cssStyleSheet = this.globalStyleSheetsCache.get(styleSheet.ownerNode);
            if (cssStyleSheet) {
                cssStyleSheets.push(cssStyleSheet);
            }
        });

        return cssStyleSheets;
    }
}

export const globalStylesStore = new GlobalStylesStore();
