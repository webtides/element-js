import { Store } from './Store.js';

class GlobalStylesStoreDefinition extends Store {
	globalStyleSheetsCache = new WeakMap();
	_mutationObserver = null;
	constructor() {
		super();
		this._mutationObserver = new MutationObserver((mutationRecord) => {
			if (!mutationRecord[0]) return;
			const filteredNodes = Array.from(mutationRecord[0].addedNodes).filter(
				(node) => node.tagName === 'STYLE' || node.tagName === 'LINK',
			);
			if (filteredNodes && filteredNodes[0] && filteredNodes[0].tagName === 'LINK') {
				filteredNodes[0].onload = () => {
					this.indexGlobalStyleSheets();
				};
			} else if (filteredNodes && filteredNodes[0] && filteredNodes[0].tagName === 'STYLE') {
				this.indexGlobalStyleSheets();
			}
		});
		this._mutationObserver.observe(globalThis.document, { subtree: true, childList: true });
		this.indexGlobalStyleSheets('document');
	}
	properties() {
		return {
			cssStyleSheets: [],
		};
	}
	indexGlobalStyleSheets(selector) {
		/** @type {CSSStyleSheet[]}*/

		this.cssStyleSheets = [
			...globalThis.document?.adoptedStyleSheets,
			...Array.from(globalThis.document?.styleSheets),
		];
	}
	getGlobalStyleSheets(selector) {
		/** @type {CSSStyleSheet[]}*/
		const cssStyleSheets = [];

		if (selector === false) return cssStyleSheets;

		if (typeof selector === 'string') {
			selector = [selector];
		}

		this.cssStyleSheets.forEach((styleSheet) => {
			if (Array.isArray(selector) && !selector.some((cssSelector) => styleSheet.ownerNode.matches(cssSelector))) {
				return;
			}

			// TODO what does this lookup actually do !!?? i think this entire thing can be a return [].filter
			let cssStyleSheet = this.globalStyleSheetsCache.get(styleSheet.ownerNode);
			if (!cssStyleSheet) {
				cssStyleSheet = new CSSStyleSheet();
				let cssText = '';
				if (styleSheet.ownerNode?.tagName === 'STYLE') {
					cssText = styleSheet.ownerNode.textContent;
				} else if (styleSheet.ownerNode?.tagName === 'LINK') {
					cssText = Array.from(styleSheet.cssRules)
						.map((rule) => rule.cssText)
						.join('');
				} else {
					// TODO what is happening here
					console.log('TODO ???', styleSheet);
				}
				cssStyleSheet.replaceSync(cssText);
			}
			cssStyleSheets.push(cssStyleSheet);
		});

		return cssStyleSheets;
	}
}

export const GlobalStylesStore = new GlobalStylesStoreDefinition();

window.GlobalStylesStore = GlobalStylesStore;
