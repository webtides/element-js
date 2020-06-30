export function getAllParentNodes(domNode) {
	let node = domNode.parentElement;
	let parents = [];
	while (node) {
		parents.unshift(node); // adds node to the beginning of parents
		node = node.parentElement;
	}

	return parents;
}

// https://stackoverflow.com/questions/27453617/how-can-i-tell-if-an-element-is-in-a-shadow-dom
export function getShadowParentOrBody(element) {
	if (element instanceof ShadowRoot) {
		return element;
	}

	while (element.parentNode && (element = element.parentNode)) {
		if (element instanceof ShadowRoot) {
			return element;
		}
	}
	return document.body;
}

// TODO: add function for getClosestParentOfNodeType('custom-element')

export function getClosestParentCustomElementNode(domNode) {
	const customElementParents = getAllParentNodes(domNode).filter((node) => {
		return node.localName && node.localName.indexOf('-') !== -1;
	});

	return customElementParents.pop();
}

export function isOfSameNodeType(nodeA, nodeB) {
	if (!nodeA && !nodeA.localName) return false;
	if (!nodeB && !nodeB.localName) return false;
	return nodeA.localName === nodeB.localName;
}

export const supportsAdoptingStyleSheets = () =>
	'adoptedStyleSheets' in Document.prototype && 'replace' in CSSStyleSheet.prototype;

// for IE11 we are using the ShadyDOM Polyfill. With the polyfill we cannot append stylesheets to the shadowRoot
export const supportsAppendingStyleSheets = !window.ShadyDOM;
