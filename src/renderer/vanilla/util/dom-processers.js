import { COMMENT_NODE, ELEMENT_NODE } from '../../../util/DOMHelper.js';
import { ChildNodePart } from './ChildNodePart.js';

/**
 * @param {Element} node
 * @param {String} name
 * @param {Boolean} oldValue
 * @return {(function(*): void)|*}
 */
const processBooleanAttribute = (node, name, oldValue) => {
	return (newValue) => {
		const value = !!newValue?.valueOf();
		if (oldValue !== value) {
			node.toggleAttribute(name, (oldValue = !!value));
		}
	};
};

/**
 * @param {Element} node
 * @param {String} name
 * @return {(function(*): void)|*}
 */
const processPropertyAttribute = (node, name) => {
	return (value) => {
		node[name] = value;
	};
};

/**
 * @param {Element} node
 * @param {String} name
 * @return {(function(*): void)|*}
 */
const processEventAttribute = (node, name) => {
	let oldValue,
		lower,
		type = name.slice(2);
	if (!(name in node) && (lower = name.toLowerCase()) in node) type = lower.slice(2);
	return (newValue) => {
		const info = Array.isArray(newValue) ? newValue : [newValue, false];
		if (oldValue !== info[0]) {
			if (oldValue) node.removeEventListener(type, oldValue, info[1]);
			if ((oldValue = info[0])) node.addEventListener(type, oldValue, info[1]);
		}
	};
};

/**
 * @param {Element} node
 * @param {String} name
 * @return {(function(*): void)|*}
 */
const processAttribute = (node, name) => {
	let oldValue,
		orphan = true;
	const attributeNode = globalThis.document?.createAttributeNS(null, name);
	return (newValue) => {
		const value = newValue?.valueOf();
		if (oldValue !== value) {
			if ((oldValue = value) == null) {
				if (!orphan) {
					node.removeAttributeNode(attributeNode);
					orphan = true;
				}
			} else {
				attributeNode.value = value;
				if (orphan) {
					node.setAttributeNodeNS(attributeNode);
					orphan = false;
				}
			}
		}
	};
};

/**
 * @param {Element} node
 * @return {ChildNode}
 */
const remove = (node) => {
	const range = globalThis.document?.createRange();
	const firstChild = Array.isArray(node) ? node[0] : node.firstChild;
	const lastChild = Array.isArray(node) ? node[node.length - 1] : node.lastChild;
	range.setStartAfter(firstChild);
	range.setEndAfter(lastChild);
	range.deleteContents();
	return node.firstChild;
};

/**
 * @param {Element} parentNode
 * @param {Element[]} domChildNodes
 * @param {Element[]} templateChildNodes
 * @param {Element} anchorNode
 * @return {Element[]}
 */
const diffNodes = function (parentNode, domChildNodes, templateChildNodes, anchorNode) {
	// Diff each node in the child node lists
	let length = Math.max(templateChildNodes.length, domChildNodes.length);
	for (let index = 0; index < length; index++) {
		const domChildNode = domChildNodes[index];
		const templateChildNode = templateChildNodes[index];

		// If the DOM node doesn't exist, append/copy the template node
		if (!domChildNode) {
			// operation = 1
			// TODO: this is kind of duplicate because these checks are also done in processNode?!
			if (templateChildNode instanceof ChildNodePart) {
				anchorNode.before(...templateChildNode.childNodes);
			} else if (Array.isArray(templateChildNode)) {
				// TODO: this was not needed with PersistentFragment?! And I think this is really slow...
				anchorNode.before(...templateChildNode);
				// TODO: this is kind of duplicate because these checks are also done in processNode?!
			} else if (typeof templateChildNode === 'object' && 'ELEMENT_NODE' in templateChildNode) {
				parentNode.insertBefore(templateChildNode, anchorNode);
			} else {
				// TODO: this might not be performant?! Can we maybe handle this in processDomNode?!
				// TODO: I think that we need to make ChildNodeParts from all primitive values as well
				parentNode.insertBefore(
					document.createTextNode(
						typeof templateChildNode === 'function' ? templateChildNode() : templateChildNode,
					),
					anchorNode,
				);
			}
			continue;
		}

		// If the template node doesn't exist, remove the node in the DOM
		if (!templateChildNode) {
			// operation = -1
			parentNode.removeChild(remove(domChildNode));
			continue;
		}

		// If DOM node is equal to the template node, don't do anything
		// if (domChildNode.isEqualNode(templateChildNode)) {
		if (domChildNode === templateChildNode) {
			continue;
		}

		// the following two checks don't have to be correct, but it could bring as back to the fast path
		// in the worst case we still have to compare and swap all the elements
		// but in the best case we find the one element that should actually be inserted or removed
		// and from there on, every node that comes after should be equal again

		// fast path for removing DOM nodes - we delete the node now instead of at the end
		// if (parentNode.childNodes.length > templateNode.childNodes.length) {
		// 	domChildNodes.splice(index, 1);
		// 	parentNode.removeChild(domChildNode);
		// 	// because domChildNodes will get shorter by splicing it, everything moves up by one
		// 	// so the (actual) next element will have the same index now as we currently have
		// 	// therefore we have to adjust our counters
		// 	length--;
		// 	index--;
		//
		// 	// we might have corrected everything and the parent nodes could be equal again
		// 	// if so, we can skip the rest of the child node checks
		// 	if (
		// 		parentNode.childNodes.length === templateNode.childNodes.length &&
		// 		parentNode.isEqualNode(templateNode)
		// 	) {
		// 		return;
		// 	}
		//
		// 	continue;
		// }

		// fast path for adding DOM nodes - we insert the node now instead of at the end
		// but NOT if we already are at the end of the list of child nodes
		// if (
		// 	index !== parentNode.childNodes.length - 1 &&
		// 	parentNode.childNodes.length < templateNode.childNodes.length
		// ) {
		// 	domChildNodes.splice(index, 0, templateChildNode);
		// 	parentNode.insertBefore(templateChildNode, domChildNode);
		//
		// 	// we might have corrected everything and the parent nodes could be equal again
		// 	// if so, we can skip the rest of the child node checks
		// 	if (
		// 		parentNode.childNodes.length === templateNode.childNodes.length &&
		// 		parentNode.isEqualNode(templateNode)
		// 	) {
		// 		return;
		// 	}
		//
		// 	continue;
		// }

		// If node types are not the same, replace the DOM node with the template node
		if (templateChildNode.nodeType !== domChildNode.nodeType) {
			parentNode.replaceChild(templateChildNode, domChildNode);
			continue;
		}

		// If the element tag names are not the same, replace the DOM node with the template node
		if (templateChildNode.nodeType === ELEMENT_NODE && templateChildNode.tagName !== domChildNode.tagName) {
			parentNode.replaceChild(templateChildNode, domChildNode);
			continue;
		}

		// If the node is an SVG element, don't even think about diffing it, just replace it
		if (templateChildNode.nodeType === ELEMENT_NODE && templateChildNode.tagName === 'SVG') {
			parentNode.replaceChild(templateChildNode, domChildNode);
			continue;
		}
	}
	return templateChildNodes;
};

/**
 * @param {Node} comment
 * @param {any} initialValue
 * @return {(function(*): void)|*}
 */
export const processNodePart = (comment, initialValue) => {
	let nodes = [];
	let oldValue =
		typeof initialValue === 'object' && initialValue instanceof ChildNodePart
			? [...initialValue.childNodes]
			: initialValue;
	// this is for string values to be inserted into the DOM. A cached TextNode will be used so that we don't have to constantly create new DOM nodes.
	let cachedTextNode = undefined;

	const processNodeValue = (newValue) => {
		switch (typeof newValue) {
			// primitives are handled as text content
			case 'string':
			case 'number':
			case 'boolean':
				if (oldValue !== newValue) {
					oldValue = newValue;
					if (!cachedTextNode) cachedTextNode = globalThis.document?.createTextNode('');
					cachedTextNode.data = newValue;

					if (comment.previousSibling?.data === comment.data.replace('/', '')) {
						// the part is empty - we haven't rendered it yet
						comment.parentNode.insertBefore(cachedTextNode, comment);
					} else {
						// the part was already rendered (either server side or on the client)
						comment.previousSibling.data = newValue;
					}

					nodes = [cachedTextNode];
				}
				break;
			// null (= typeof "object") and undefined are used to clean up previous content
			case 'object':
			case 'undefined':
				if (newValue == null) {
					if (oldValue != newValue) {
						oldValue = newValue;
						// remove all child nodes
						while (comment.previousSibling) {
							if (
								comment.previousSibling.nodeType === COMMENT_NODE &&
								comment.previousSibling.data.includes('dom-part-')
							) {
								break;
							}
							comment.parentNode.removeChild(comment.previousSibling);
						}
						nodes = [];
					}
					break;
				}
				if (Array.isArray(newValue)) {
					if (newValue.length === 0) {
						// remove all child nodes
						while (comment.previousSibling) {
							if (
								comment.previousSibling.nodeType === COMMENT_NODE &&
								comment.previousSibling.data === comment.data.replace('/', '')
							) {
								break;
							}
							comment.parentNode.removeChild(comment.previousSibling);
						}
						nodes = [];
					}
					// or diff if they contain nodes or fragments
					else {
						nodes = diffNodes(comment.parentNode, oldValue || [], newValue, comment);
					}
					oldValue = newValue;
					break;
				}
				// if the new value is a node or a fragment, and it's different from the live node, then it's diffed.
				if (oldValue !== newValue) {
					if ('ELEMENT_NODE' in newValue) {
						oldValue = newValue;
						nodes = diffNodes(
							comment.parentNode,
							nodes,
							newValue instanceof ChildNodePart ? [...newValue.childNodes] : [newValue],
							comment,
						);
					} else {
						const value = newValue.valueOf();
						if (value !== newValue) processNodeValue(value);
					}
				}
				break;
			case 'function':
				processNodeValue(newValue(comment));
				break;
		}
	};

	return processNodeValue;
};

/**
 * @param {Element} node
 * @param {String} name
 * @return {(function(*): void)|*}
 */
export const processAttributePart = (node, name) => {
	// boolean attribute: ?boolean=${...}
	if (name.startsWith('?')) {
		return processBooleanAttribute(node, name.slice(1), false);
	}

	// property attribute: .property=${...}
	if (name.startsWith('.')) {
		return processPropertyAttribute(node, name.slice(1));
	}

	// event attribute: @event=${...}
	if (name.startsWith('@')) {
		return processEventAttribute(node, 'on' + name.slice(1));
	}

	// "old school" event attribute: onevent=${...}
	if (name.startsWith('on')) {
		return processEventAttribute(node, name);
	}

	// normal "string" attribute: attribute=${...}
	return processAttribute(node, name);
};
