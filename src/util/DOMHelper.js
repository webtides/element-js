/* An Element node like <p> or <div> */
export const ELEMENT_NODE = 1;
/* An Attribute of an Element */
export const ATTRIBUTE_NODE = 2;
/* The actual Text inside an Element or Attr */
export const TEXT_NODE = 3;
/* A Comment node, such as <!-- … --> */
export const COMMENT_NODE = 8;

/**
 * Gets a list of (childNode) indexes for the given node
 * @param {Node} node
 * @return {number[]}
 */
export const getNodePath = (node) => {
	const path = [];
	let parentNode = node.parentNode;
	while (parentNode) {
		path.push([...parentNode.childNodes].indexOf(node));
		node = parentNode;
		parentNode = node.parentNode;
	}
	return path;
};

/**
 * Get a list of all parent nodes up the DOM tree
 * @param {Node} domNode
 * @returns {Node[]}
 */
export function getAllParentNodes(domNode) {
	let node = domNode.parentElement;
	let parents = [];
	while (node) {
		parents.unshift(node); // adds node to the beginning of parents
		node = node.parentElement;
	}

	return parents;
}

/**
 * Gets the parent/root element of a shadow root or the global document body if not in shadow root.
 * https://stackoverflow.com/questions/27453617/how-can-i-tell-if-an-element-is-in-a-shadow-dom
 * @param {Node} element
 * @returns {ShadowRoot | HTMLElement}
 */
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

/**
 * Get the closest/first parent node that is a custom element
 * @param {Node} domNode
 * @returns {Node}
 */
export function getClosestParentCustomElementNode(domNode) {
	const customElementParents = getAllParentNodes(domNode).filter((node) => {
		return node.localName && node.localName.indexOf('-') !== -1;
	});

	return customElementParents.pop();
}

/**
 * Checks whether two nodes are of the same node type
 * @param {Node} nodeA
 * @param {Node} nodeB
 * @returns {boolean}
 */
export function isOfSameNodeType(nodeA, nodeB) {
	if (!nodeA && !nodeA.localName) return false;
	if (!nodeB && !nodeB.localName) return false;
	return nodeA.localName === nodeB.localName;
}

/**
 * Checks if adopting style sheets is supported in browser
 * @returns {boolean}
 */
export const supportsAdoptingStyleSheets = () => {
	return 'adoptedStyleSheets' in Document.prototype && 'replace' in CSSStyleSheet.prototype;
};

/**
 * Better implementation of hasChildNodes check because the native check will also count for empty whitespace as child nodes... :(
 * @param {Node} node
 * @returns {boolean}
 */
export const hasChildNodes = (node) => {
	const childNodesLength = node.childNodes.length;

	if (childNodesLength === 0) return false;

	if (childNodesLength === 1 && node.firstChild.nodeType === 3 && node.firstChild.textContent.trim() === '')
		return false;

	// children will not contain text nodes...
	if (childNodesLength > 0) return true;

	// TODO: check if more than 1 child nodes, but all childnodes are whitespace text ndoes?!
};

/**
 * Parses the given string as HTML template and returns a real DOM element
 * @param {string} template
 * @returns {HTMLElement}
 */
export const convertStringToHTML = (template) => {
	const parser = new DOMParser();
	const document = parser.parseFromString(template.toString(), 'text/html');
	return document.body;
};

/**
 * Parses the given string and returns a DocumentFragment
 * which contains the DOM subtree representing the <template> element's template contents.
 * @param {string} string
 * @return {DocumentFragment}
 */
export const convertStringToTemplate = (string) => {
	const template = globalThis.document?.createElement('template');
	// TODO: ensure that SSRed and CSRed templates have the same amount of whitespace text nodes
	template.innerHTML = string.trimStart().trimEnd();
	return template.content;
};

/**
 * Diff the attributes for a live DOM element against a template DOM element
 * @param {Element} templateElement - The new template
 * @param {Element} domElement - The existing DOM node
 */
export const diffAttributes = function (templateElement, domElement) {
	// remove or update previous attributes
	for (/** @type {Attr} */ const attribute of Array.from(domElement.attributes)) {
		if (templateElement.hasAttribute(attribute.name)) {
			const oldValue = attribute.value;
			const newValue = templateElement.getAttribute(attribute.name) || '';
			if (oldValue !== newValue) {
				domElement.setAttribute(attribute.name, newValue);
			}
		} else {
			domElement.removeAttribute(attribute.name);
		}
	}

	// set newly added attributes
	for (/** @type {Attr} */ const attribute of Array.from(templateElement.attributes)) {
		if (!domElement.hasAttribute(attribute.name)) {
			domElement.setAttribute(attribute.name, attribute.value);
		}
	}
};

/**
 * Diff a live DOM node against a template DOM node
 * @param {Node} templateNode
 * @param {Node} domNode
 * @param {(Node) => Boolean} shouldDiffChildNodes
 */
export const diffNodes = function (templateNode, domNode, shouldDiffChildNodes = (templateChildNode) => true) {
	// If the DOM node should be empty, remove all child nodes
	if (hasChildNodes(domNode) && !hasChildNodes(templateNode)) {
		domNode.replaceChildren();
		return;
	}

	// If the DOM node is empty, but should have children, add child nodes from the template node
	if (!hasChildNodes(domNode) && hasChildNodes(templateNode)) {
		domNode.replaceChildren(...templateNode.childNodes);
		return;
	}

	const templateChildNodes = [...templateNode.childNodes];
	const domChildNodes = [...domNode.childNodes];

	// Diff each node in the child node lists
	let length = Math.max(templateChildNodes.length, domChildNodes.length);
	for (let index = 0; index < length; index++) {
		const templateChildNode = templateChildNodes[index];
		const domChildNode = domChildNodes[index];

		// If the DOM node doesn't exist, append/copy the template node
		if (!domChildNode) {
			domNode.appendChild(templateChildNode);
			continue;
		}

		// If the template node doesn't exist, remove the node in the DOM
		if (!templateChildNode) {
			domNode.removeChild(domChildNode);
			continue;
		}

		// If DOM node is equal to the template node, don't do anything
		if (domChildNode.isEqualNode(templateChildNode)) {
			continue;
		}

		// the following two checks don't have to be correct, but it could bring as back to the fast path
		// in the worst case we still have to compare and swap all the elements
		// but in the best case we find the one element that should actually be inserted or removed
		// and from there on, every node that comes after should be equal again

		// fast path for removing DOM nodes - we delete the node now instead of at the end
		if (domNode.childNodes.length > templateNode.childNodes.length) {
			domChildNodes.splice(index, 1);
			domNode.removeChild(domChildNode);
			// because domChildNodes will get shorter by splicing it, everything moves up by one
			// so the (actual) next element will have the same index now as we currently have
			// therefore we have to adjust our counters
			length--;
			index--;

			// we might have corrected everything and the parent nodes could be equal again
			// if so, we can skip the rest of the child node checks
			if (domNode.childNodes.length === templateNode.childNodes.length && domNode.isEqualNode(templateNode)) {
				return;
			}

			continue;
		}

		// fast path for adding DOM nodes - we insert the node now instead of at the end
		// but NOT if we already are at the end of the list of child nodes
		if (index !== domNode.childNodes.length - 1 && domNode.childNodes.length < templateNode.childNodes.length) {
			domChildNodes.splice(index, 0, templateChildNode);
			domNode.insertBefore(templateChildNode, domChildNode);

			// we might have corrected everything and the parent nodes could be equal again
			// if so, we can skip the rest of the child node checks
			if (domNode.childNodes.length === templateNode.childNodes.length && domNode.isEqualNode(templateNode)) {
				return;
			}

			continue;
		}

		// If node types are not the same, replace the DOM node with the template node
		if (templateChildNode.nodeType !== domChildNode.nodeType) {
			domNode.replaceChild(templateChildNode, domChildNode);
			continue;
		}

		// If the node is a Text node or a Comment node, update it
		if (domChildNode.nodeType === TEXT_NODE || domChildNode.nodeType === COMMENT_NODE) {
			domChildNode.textContent = templateChildNode.textContent;
			continue;
		}

		// If the element tag names are not the same, replace the DOM node with the template node
		if (templateChildNode.nodeType === ELEMENT_NODE && templateChildNode.tagName !== domChildNode.tagName) {
			domNode.replaceChild(templateChildNode, domChildNode);
			continue;
		}

		// If the node is an SVG element, don't even think about diffing it, just replace it
		if (templateChildNode.nodeType === ELEMENT_NODE && templateChildNode.tagName === 'SVG') {
			domNode.replaceChild(templateChildNode, domChildNode);
			continue;
		}

		// If the node is an Element node, diff the attributes
		if (templateChildNode.nodeType === ELEMENT_NODE) {
			diffAttributes(templateChildNode, domChildNode);
		}

		// If there are child nodes, diff them recursively
		if (templateChildNode.hasChildNodes()) {
			if (shouldDiffChildNodes(templateChildNode)) {
				diffNodes(templateChildNode, domChildNode);
			}
		}
	}
};
