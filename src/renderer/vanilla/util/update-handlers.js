import udomdiff from './udomdiff';

const nodeType = 111;

const { createDocumentFragment, createElement, createElementNS, createTextNode, createTreeWalker, importNode } =
	new Proxy(document, {
		get: (target, method) => target[method].bind(target),
	});

const reducePath = ({ childNodes }, i) => childNodes[i];

const getValue = (value) => (value == null ? value : value.valueOf());

const boolean = (node, key, oldValue) => (newValue) => {
	const value = !!getValue(newValue);
	if (oldValue !== value) {
		node.toggleAttribute(key, (oldValue = !!value));
	}
};

const setter = (node, key) =>
	key === 'dataset'
		? data(node)
		: (value) => {
				node[key] = value;
		  };

const data =
	({ dataset }) =>
	(values) => {
		for (const key in values) {
			const value = values[key];
			if (value == null) delete dataset[key];
			else dataset[key] = value;
		}
	};

export const event = (node, name) => {
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

export const attribute = (node, name) => {
	let oldValue,
		orphan = true;
	const attributeNode = document.createAttributeNS(null, name);
	return (newValue) => {
		//const value = useForeign && newValue instanceof Foreign ? newValue._(node, name) : getValue(newValue);
		const value = getValue(newValue);
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
	const range = document.createRange();
	range.setStartAfter(firstChild);
	range.setEndAfter(lastChild);
	range.deleteContents();
	return firstChild;
};

export const diffable = (node, operation) =>
	node.nodeType === nodeType
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
const handleAnything = (comment) => {
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
					if (!text) text = createTextNode('');
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
						nodes = diff(comment, nodes, newValue.nodeType === 11 ? [...newValue.childNodes] : [newValue]);
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

// attributes can be:
//  * ref=${...}      for hooks and other purposes
//  * aria=${...}     for aria attributes
//  * ?boolean=${...} for boolean attributes
//  * .dataset=${...} for dataset related attributes
//  * .setter=${...}  for Custom Elements setters or nodes with setters
//                    such as buttons, details, options, select, etc
//  * @event=${...}   to explicitly handle event listeners
//  * onevent=${...}  to automatically handle event listeners
//  * generic=${...}  to handle an attribute just like an attribute
const handleAttribute = (node, name /*, svg*/) => {
	switch (name[0]) {
		case '?':
			return boolean(node, name.slice(1), false);
		case '.':
			return setter(node, name.slice(1));
		case '@':
			return event(node, 'on' + name.slice(1));
		case 'o':
			if (name[1] === 'n') return event(node, name);
	}

	// switch (name) {
	// 	case 'ref':
	// 		return ref(node);
	// 	case 'aria':
	// 		return aria(node);
	// }

	return attribute(node, name);
};

// TODO: rename to Processors ?!
// each mapped update carries the update type and its path
// the type is either node, attribute, or text, while
// the path is how to retrieve the related node to update.
// In the attribute case, the attribute name is also carried along.
export function updateHandlers(options) {
	const { type, path } = options;
	const node = path.reduceRight(reducePath, this);
	return type === 'node' ? handleAnything(node) : type === 'attr' ? handleAttribute(node, options.name) : text(node);
}
