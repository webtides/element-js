import { Store } from './Store.js';

/**
 * @property {CSSStyleSheet[]} cssStyleSheets
 */
class GlobalStylesStore extends Store {
    /** @type {Map<Node, CSSStyleSheet>} */
    globalStyleSheetsCache = new WeakMap();

    constructor() {
        super();
        if (globalThis.elementJsConfig?.observeGlobalStyles) {
            const mutationObserver = new MutationObserver((mutationRecord) => {
                if (!mutationRecord[0]) return;
                const filteredNodes = Array.from(mutationRecord[0].addedNodes).filter(
                    (node) => node.tagName === 'STYLE' || node.tagName === 'LINK',
                );
                if (filteredNodes && filteredNodes[0] && filteredNodes[0].tagName === 'LINK') {
                    filteredNodes[0].onload = () => {
                        this.requestUpdate();
                    };
                } else if (filteredNodes && filteredNodes[0] && filteredNodes[0].tagName === 'STYLE') {
                    this.requestUpdate();
                }
            });
            mutationObserver.observe(globalThis.document, { subtree: true, childList: true });
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

            // TODO: this will always be null as we never set anything to the cache...
            let cssStyleSheet = this.globalStyleSheetsCache.get(styleSheet.ownerNode);
            if (!cssStyleSheet) {
                if (styleSheet.ownerNode.tagName === 'STYLE') {
                    cssStyleSheet = new CSSStyleSheet({ media: styleSheet.media, disabled: styleSheet.disabled });
                    cssStyleSheet.replaceSync(styleSheet.ownerNode.textContent);
                } else if (styleSheet.ownerNode.tagName === 'LINK') {
                    cssStyleSheet = new CSSStyleSheet({
                        baseURL: styleSheet.href,
                        media: styleSheet.media,
                        disabled: styleSheet.disabled,
                    });
                    try {
                        Array.from(styleSheet?.cssRules ?? []).map((rule, index) =>
                            cssStyleSheet.insertRule(rule.cssText, index),
                        );
                    } catch (e) {
                        console.error(
                            'GlobalStylesStore: cannot read cssRules. Maybe add crossorigin="anonymous" to your style link?',
                            e,
                        );
                    }
                }
            }
            cssStyleSheets.push(cssStyleSheet);
        });

        return cssStyleSheets;
    }
}

export const globalStylesStore = new GlobalStylesStore();
