import { PERSISTENT_DOCUMENT_FRAGMENT_NODE } from '../../../util/DOMHelper.js';

// https://github.com/whatwg/dom/issues/736
/**
 * Keeps the references of child nodes after they have been added/inserted into a real document
 * other than a "normal" Fragment that will be empty after such operations
 */
export class PersistentFragment {
	// TODO: I think we can get rid of this ^ if we simply store childNodes[] on ChildNodePart
	childNodes = [];

	constructor(node) {
		if (node instanceof DocumentFragment) {
			const fragment = globalThis.document?.importNode(node, true);
			this.childNodes = [...fragment.childNodes];
		} else if (Array.isArray(node)) {
			this.childNodes = [...node];
		} else {
			this.childNodes = [...node.childNodes];
		}
	}

	get ELEMENT_NODE() {
		return ELEMENT_NODE;
	}

	get nodeType() {
		return PERSISTENT_DOCUMENT_FRAGMENT_NODE;
	}

	get firstChild() {
		return this.childNodes[0];
	}

	get lastChild() {
		return this.childNodes[this.childNodes.length - 1];
	}
}
