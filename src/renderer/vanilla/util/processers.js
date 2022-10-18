import udomdiff from './udomdiff';
import { DOCUMENT_FRAGMENT_NODE, PERSISTENT_DOCUMENT_FRAGMENT_NODE } from '../../../util/DOMHelper';
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

const remove = ({ firstChild, lastChild }) => {
	const range = globalThis.document?.createRange();
	range.setStartAfter(firstChild);
	range.setEndAfter(lastChild);
	range.deleteContents();
	return firstChild;
};

export const diffable = (node, operation) =>
	node.nodeType === PERSISTENT_DOCUMENT_FRAGMENT_NODE
		? 1 / operation < 0
			? operation
				? remove(node)
				: node.lastChild
			: operation
			? node.valueOf()
			: node.firstChild
		: node;

// TODO: make it work with our diffing algorithm...
// this helper avoid code bloat around handleAnything() callback
const diff = (comment, oldNodes, newNodes) =>
	udomdiff(
		comment.parentNode,
		// TODO: there is a possible edge case where a node has been
		//       removed manually, or it was a keyed one, attached
		//       to a shared reference between renders.
		//       In this case udomdiff might fail at removing such node
		//       as its parent won't be the expected one.
		//       The best way to avoid this issue is to filter oldNodes
		//       in search of those not live, or not in the current parent
		//       anymore, but this would require both a change to uwire,
		//       exposing a parentNode from the firstChild, as example,
		//       but also a filter per each diff that should exclude nodes
		//       that are not in there, penalizing performance quite a lot.
		//       As this has been also a potential issue with domdiff,
		//       and both lighterhtml and hyperHTML might fail with this
		//       very specific edge case, I might as well document this possible
		//       "diffing shenanigan" and call it a day.
		oldNodes,
		newNodes,
		diffable,
		comment,
	);

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
					nodes = diff(comment, nodes, [text]);
				}
				break;
			// null, and undefined are used to cleanup previous content
			case 'object':
			case 'undefined':
				if (newValue == null) {
					if (oldValue != newValue) {
						oldValue = newValue;
						nodes = diff(comment, nodes, []);
					}
					break;
				}
				// arrays and nodes have a special treatment
				if (Array.isArray(newValue)) {
					oldValue = newValue;
					// arrays can be used to cleanup, if empty
					if (newValue.length === 0) nodes = diff(comment, nodes, []);
					// or diffed, if these contains nodes or "wires"
					else if (typeof newValue[0] === 'object') nodes = diff(comment, nodes, newValue);
					// in all other cases the content is stringified as is
					else anyContent(String(newValue));
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
						nodes = diff(
							comment,
							nodes,
							newValue.nodeType === DOCUMENT_FRAGMENT_NODE ? [...newValue.childNodes] : [newValue],
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
