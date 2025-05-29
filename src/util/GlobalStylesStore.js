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
                        // TODO maybe its possible to simply aff the node aka sytlesheet !?
                        this.createGlobalStyleSheetsCache();
                        this.requestUpdate();
                    };
                } else if (filteredNodes && filteredNodes[0] && filteredNodes[0].tagName === 'STYLE') {
                    this.createGlobalStyleSheetsCache();
                    this.requestUpdate();
                }
            });
            mutationObserver.observe(globalThis.document, { subtree: true, childList: true });
        } else {
            this.createGlobalStyleSheetsCache();
        }
    }

    createGlobalStyleSheetsCache() {
        // TODO create early return in node is already in
        console.time('createGlobalStyleSheetsCache');
        console.timeLog('createGlobalStyleSheetsCache', 'BUILD OR REBUILD');
        Array.from(globalThis.document?.styleSheets).map((styleSheet) => {
            // TODO: this will always be null as we never set anything to the cache...
            let cssStyleSheet = this.globalStyleSheetsCache.get(styleSheet.ownerNode);
            if (!cssStyleSheet) {
                // if it does not exist yet -> build it
                if (styleSheet.ownerNode.tagName === 'STYLE') {
                    const cssStyleSheet = new CSSStyleSheet({ media: styleSheet.media, disabled: styleSheet.disabled });
                    cssStyleSheet.replaceSync(styleSheet.ownerNode.textContent);

                    this.globalStyleSheetsCache.set(styleSheet.ownerNode, cssStyleSheet);
                } else if (styleSheet.ownerNode.tagName === 'LINK') {
                    const cssStyleSheet = new CSSStyleSheet({
                        baseURL: styleSheet.href,
                        media: styleSheet.media,
                        disabled: styleSheet.disabled,
                    });
                    try {
                        console.timeLog('createGlobalStyleSheetsCache', '## 1');
                        // TODO this is like suuuuper expensive approx 22ms
                        Array.from(styleSheet?.cssRules ?? []).map((rule, index) =>
                            cssStyleSheet.insertRule(rule.cssText, index),
                        );
                        console.timeLog('createGlobalStyleSheetsCache', '## 2');
                        this.globalStyleSheetsCache.set(styleSheet.ownerNode, cssStyleSheet);
                    } catch (e) {
                        console.error(
                            'GlobalStylesStore: cannot read cssRules. Maybe add crossorigin="anonymous" to your style link?',
                            e,
                        );
                    }
                }
            }
        });
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
