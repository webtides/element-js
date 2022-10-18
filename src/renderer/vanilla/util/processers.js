import {
	COMMENT_NODE,
	diffAttributes,
	DOCUMENT_FRAGMENT_NODE,
	ELEMENT_NODE,
	hasChildNodes,
	isTemplateElement,
	PERSISTENT_DOCUMENT_FRAGMENT_NODE,
	TEXT_NODE,
} from '../../../util/DOMHelper';
import { AttributePart, ChildNodePart } from './render';

const processBooleanAttribute = (node, key, oldValue) => {
	return (newValue) => {
		const value = !!newValue?.valueOf();
		if (oldValue !== value) {
			node.toggleAttribute(key, (oldValue = !!value));
		}
	};
};

const processPropertyAttribute = (node, key) => {
	return (value) => {
		node[key] = value;
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

// TODO: can we get rid of this stupid code?!
const remove = ({ firstChild, lastChild }) => {
	const range = globalThis.document?.createRange();
	range.setStartAfter(firstChild);
	range.setEndAfter(lastChild);
	range.deleteContents();
	return firstChild;
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
			parentNode.insertBefore(templateChildNode.valueOf(), anchorNode);
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

// if an interpolation represents a comment, the whole
// diffing will be related to such comment.
// This helper is in charge of understanding how the new
// content for such interpolation/hole should be updated
const processNodePart = (comment) => {
	let oldValue,
		text,
		nodes = [];
	const anyContent = (newValue) => {
		switch (typeof newValue) {
			// primitives are handled as text content
			case 'string':
			case 'number':
			case 'boolean':
				if (oldValue !== newValue) {
					oldValue = newValue;
					if (!text) text = globalThis.document?.createTextNode('');
					text.data = newValue;
					text.$part = comment.data;
					//nodes = diff(comment, nodes, [text]);
					if (comment.previousSibling?.$part === comment.data) {
						comment.previousSibling.data = newValue;
					} else {
						comment.parentNode.insertBefore(text, comment);
					}
					nodes = [text];
				}
				break;
			// null, and undefined are used to cleanup previous content
			case 'object':
			case 'undefined':
				if (newValue == null) {
					if (oldValue != newValue) {
						oldValue = newValue;
						// remove all child nodes
						// nodes = diff(comment, nodes, []);
						while (comment.previousSibling) {
							comment.parentNode.removeChild(comment.previousSibling);
						}
						nodes = [];
					}
					break;
				}
				if (Array.isArray(newValue)) {
					if (newValue.length === 0) {
						// remove all child nodes
						// nodes = diff(comment, nodes, []);
						while (comment.previousSibling) {
							comment.parentNode.removeChild(comment.previousSibling);
						}
						nodes = [];
					}
					// else if (oldValue.length === 0) {
					// 	for (const newValueElement of newValue) {
					// 		comment.parentNode.insertBefore(newValueElement.valueOf(), comment);
					// 	}
					// }
					// or diffed, if these contains nodes or "wires"
					else if (typeof newValue[0] === 'object') {
						// nodes = diff(comment, nodes, newValue);
						nodes = diffNodes(comment.parentNode, nodes, newValue, comment);
					}
					// in all other cases the content is stringified as is
					else anyContent(String(newValue));
					oldValue = newValue;
					break;
				}
				// if the new value is a DOM node, or a wire, and it's
				// different from the one already live, then it's diffed.
				// if the node is a fragment, it's appended once via its childNodes
				// There is no `else` here, meaning if the content
				// is not expected one, nothing happens, as easy as that.
				if (oldValue !== newValue) {
					if ('ELEMENT_NODE' in newValue) {
						oldValue = newValue;
						// nodes = diff(
						// 	comment,
						// 	nodes,
						// 	newValue.nodeType === DOCUMENT_FRAGMENT_NODE ? [...newValue.childNodes] : [newValue],
						// );
						nodes = diffNodes(
							comment.parentNode,
							nodes,
							newValue.nodeType === DOCUMENT_FRAGMENT_NODE ? [...newValue.childNodes] : [newValue],
							comment,
						);
					} else {
						const value = newValue.valueOf();
						if (value !== newValue) anyContent(value);
					}
				}
				break;
			case 'function':
				anyContent(newValue(comment));
				break;
		}
	};
	return anyContent;
};

const processAttributePart = (node, name) => {
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

export function processPart(part) {
	// TODO: do we really need this path reducing?! The part has a reference to the node already no?!
	const node = part.path.reduceRight(({ childNodes }, i) => childNodes[i], this);

	if (part instanceof ChildNodePart) {
		return processNodePart(node);
	}

	if (part instanceof AttributePart) {
		return processAttributePart(node, part.name);
	}

	return text(node);
}
