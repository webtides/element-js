import { Store } from './Store.js';

/**
 * @property {CSSStyleSheet[]} cssStyleSheets
 */
class GlobalStylesStore extends Store {
    /** @type {WeakMap<Node, CSSStyleSheet>} */
    globalStyleSheetsCache = new WeakMap();
    counter = 0;

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
                // TODO WTF !? this has to be done for every node .. not only the first !?
                if (styleNode.tagName === 'LINK') {
                    if (styleNode.sheet) {
                        // already loaded
                        this.processStylesheet(styleNode);
                    } else {
                        // wait for download
                        styleNode.onload = () => {
                            this.processStylesheet(styleNode);
                        };
                    }
                } else if (styleNode.tagName === 'STYLE') {
                    this.processStylesheet(styleNode);
                }
            });
        });
        mutationObserver.observe(globalThis.document, { subtree: true, childList: true });
    }

    async processStylesheet(styleSheet) {
        let cssStyleSheet = this.globalStyleSheetsCache.get(styleSheet.ownerNode);
        if (!cssStyleSheet) {
            const timerName = `processStylesheet-${this.counter++}`;
            console.time(timerName);
            // if it does not exist yet -> build it
            if (styleSheet.ownerNode.tagName === 'STYLE') {
                const cssStyleSheet = new CSSStyleSheet({ media: styleSheet.media, disabled: styleSheet.disabled });
                console.timeLog(timerName, `## Style 1: ${styleSheet.href}`);
                cssStyleSheet.replaceSync(styleSheet.ownerNode.textContent);
                console.timeLog(timerName, `## Style 2: ${styleSheet.href}`);

                this.globalStyleSheetsCache.set(styleSheet.ownerNode, cssStyleSheet);
            } else if (styleSheet.ownerNode.tagName === 'LINK') {
                const cssStyleSheet = new CSSStyleSheet({
                    baseURL: styleSheet.href,
                    media: styleSheet.media,
                    disabled: styleSheet.disabled,
                });
                try {
                    console.timeLog(timerName, `## LINK 1: ${styleSheet.href}`);
                    // TODO this is like super expensive... - approx 22ms
                    // original version
                    Array.from(styleSheet?.cssRules ?? []).map((rule, index) =>
                        cssStyleSheet.insertRule(rule.cssText, index),
                    );

                    // TODO: this is a bit faster... but still expensive - approx 20ms
                    // TODO: slowser for me in chrome ... more like 56ms
                    // Get all CSS text in one go
                    // const allCssText = Array.from(styleSheet.cssRules)
                    //     .map((rule) => rule.cssText)
                    //     .join('\n');
                    // // Apply all at once
                    // cssStyleSheet.replace(allCssText);

                    // TODO im not sure i like this, but i would assume that the request is cached already?! - approx 1ms
                    // Fetch the CSS content directly from the href
                    // todo -> nope this is by far the slowest (250ms) and moves the adoption to the very end.
                    // try {
                    //     const response = await fetch(styleSheet.href);
                    //     const cssText = await response.text();
                    //     await cssStyleSheet.replace(cssText);
                    // } catch (e) {
                    //     console.error('GlobalStylesStore: Cannot fetch stylesheet content', e);
                    // }

                    this.globalStyleSheetsCache.set(styleSheet.ownerNode, cssStyleSheet);

                    console.log('## added to the cache: ', cssStyleSheet);
                    console.timeLog(timerName, `## LINK AFTER: ${styleSheet.href}`);
                    // update observer that there might be new styles to adopt
                    this.requestUpdate();
                } catch (e) {
                    console.error(
                        'GlobalStylesStore: cannot read cssRules. Maybe add crossorigin="anonymous" to your style link?',
                        e,
                    );
                }
            }

            console.log('#######    ################');
            console.timeEnd(timerName);
            console.log(`#######    ${styleSheet.ownerNode}`);
            console.log(`#######    rules      :: ${styleSheet.rules.length}`);
            console.log('#######    ################');
        } else {
            console.log('GlobalStylesStore: cache hit,  already processed', styleSheet);
        }
    }

    async createGlobalStyleSheetsCache() {
        return Promise.all(
            Array.from(globalThis.document?.styleSheets).map((styleSheet) => this.processStylesheet(styleSheet)),
        );
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
