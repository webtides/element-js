import { COMMENT_NODE, DOCUMENT_FRAGMENT_NODE, ELEMENT_NODE } from '../../../util/DOMHelper.js';
import { PersistentFragment } from './PersistentFragment.js';

const processBooleanAttribute = (node, name, oldValue) => {
	return (newValue) => {
		const value = !!newValue?.valueOf();
		if (oldValue !== value) {
			node.toggleAttribute(name, (oldValue = !!value));
		}
	};
};

const processPropertyAttribute = (node, name) => {
	return (value) => {
		node[name] = value;
	};
};

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

const remove = (node) => {
	const range = globalThis.document?.createRange();
	range.setStartAfter(node.firstChild);
	range.setEndAfter(node.lastChild);
	range.deleteContents();
	return node.firstChild;
};

const diffNodes = function (parentNode, domChildNodes, templateChildNodes, anchorNode) {
	// Diff each node in the child node lists
	let length = Math.max(templateChildNodes.length, domChildNodes.length);
	for (let index = 0; index < length; index++) {
		const domChildNode = domChildNodes[index];
		const templateChildNode = templateChildNodes[index];

		// If the DOM node doesn't exist, append/copy the template node
		if (!domChildNode) {
			// operation = 1
			if (templateChildNode instanceof PersistentFragment) {
				anchorNode.before(...templateChildNode.childNodes);
			} else {
				parentNode.insertBefore(templateChildNode, anchorNode);
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

// this is for string values to be inserted into the DOM. A cached TextNode will be used so that we don't have to constantly create new DOM nodes.
let cachedTextNode = undefined;

export const processNodePart = (comment) => {
	let nodes = [];

	const processNodeValue = (newValue, oldValue) => {
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
								comment.previousSibling.data.includes('dom-part-')
							) {
								break;
							}
							comment.parentNode.removeChild(comment.previousSibling);
						}
						nodes = [];
					}
					// else if (oldValue.length === 0) {
					// 	for (const newValueElement of newValue) {
					// 		comment.parentNode.insertBefore(newValueElement.valueOf(), comment);
					// 	}
					// }
					// or diff if they contain nodes or fragments
					// TODO: what if the array has mixed content?! object, primitives and functions?!
					else if (typeof newValue[0] === 'object') {
						nodes = oldValue || [];
						// nodes = diff(comment, nodes, newValue);
						// TODO: when rendering server side, nodes is empty :(
						// How do we get the nodes?! WTF?!
						nodes = diffNodes(comment.parentNode, nodes, newValue, comment);
					}
					// in all other cases the value is stringified
					else processNodeValue(String(newValue));
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
							// TODO: could we also use .valueOf() here ?!
							newValue.nodeType === DOCUMENT_FRAGMENT_NODE ? [...newValue.childNodes] : [newValue],
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

	// TODO: implement refs...
	// reference attribute: ref=${...}
	// if (name === 'ref') {
	// 	return ref(node);
	// }

	// normal "string" attribute: attribute=${...}
	return processAttribute(node, name);
};
