import { hasChildNodes } from '../../../util/DOMHelper';
import udomdiff from './udomdiff.js';
import { TemplateLiteral } from './html';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;
const nodeType = 111;

const _cachedTemplateElements = {};

/**
 * Parses the given template string and returns a real DOM element.
 * @param {string} template
 * @returns {HTMLElement}
 */
const convertStringToHTML = (template) => {
	const parser = new DOMParser();
	const document = parser.parseFromString(template.toString(), 'text/html');
	return document.body;
};

/**
 * Diff the attributes for a live DOM element against a template DOM element
 * @param  {Element} templateElement The new template
 * @param  {Element} domElement The existing DOM node
 */
const diffAttributes = function (templateElement, domElement) {
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
 * Checks whether the given element or node is a TemplateElement or not
 * @param {Element|Node} element
 * @returns {boolean}
 */
const isTemplateElement = (element) => {
	const tagName = element.tagName?.toLowerCase() ?? false;
	if (!tagName || !tagName.includes('-')) {
		return false;
	}

	if (_cachedTemplateElements[tagName]) {
		return true;
	}

	const elementClass = customElements.get(tagName);
	const isTemplateElement = elementClass && elementClass._$templateElement$ === true;

	if (isTemplateElement) {
		_cachedTemplateElements[tagName] = elementClass;
	}

	return isTemplateElement;
};

/**
 * Diff a live DOM node against a template DOM node
 * @param {Node} templateNode
 * @param {Node} domNode
 */
const diffNodes = function (templateNode, domNode) {
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
			if (!isTemplateElement(templateChildNode)) {
				diffNodes(templateChildNode, domChildNode);
			}
		}
	}
};

// from a fragment container, create an array of indexes
// related to its child nodes, so that it's possible
// to retrieve later on exact node via reducePath
const createPath = (node) => {
	const path = [];
	let { parentNode } = node;
	while (parentNode) {
		path.push([...parentNode.childNodes].indexOf(node));
		node = parentNode;
		({ parentNode } = node);
	}
	return path;
};

const { createDocumentFragment, createElement, createElementNS, createTextNode, createTreeWalker, importNode } =
	new Proxy(document, {
		get: (target, method) => target[method].bind(target),
	});

// the prefix is used to identify either comments, attributes, or nodes
// that contain the related unique id. In the attribute cases
// isµX="attribute-name" will be used to map current X update to that
// attribute name, while comments will be like <!--isµX-->, to map
// the update to that specific comment node, hence its parent.
// style and textarea will have <!--isµX--> text content, and are handled
// directly through text-only updates.
const prefix = 'isµ';

// TODO: find a better name for TemplateInfo...
export const createTemplateInfo = () => ({
	stack: [], // each template gets a stack for each interpolation "hole"

	entry: null, // each entry contains details, such as:
	//  * the template that is representing
	//  * the type of node it represents (html or svg)
	//  * the content fragment with all nodes
	//  * the list of updates per each node (template holes)
	//  * the "wired" node or fragment that will get updates
	// if the template or type are different from the previous one
	// the entry gets re-created each time

	wire: null, // each rendered node represent some wired content and
	// this reference to the latest one. If different, the node
	// will be cleaned up and the new "wire" will be appended
});

// the entry stored in the rendered node cache, and per each "hole"
const createEntry = (strings) => {
	const { templateNode, updates } = mapUpdates(strings);
	return { strings, templateNode, updates, wire: null };
};

export const createContent = (text) => createHTML(text);

// TODO: use convertStringToHTML ?!
const createHTML = (html) => {
	const template = createElement('template');
	template.innerHTML = html;
	return template.content;
};

// Template Literals are unique per scope and static, meaning a template
// should be parsed once, and once only, as it will always represent the same
// content, within the exact same amount of updates each time.
// This cache relates each template to its unique content and updates.
const templateStrings = new WeakMap();

// if a template is unknown, perform the previous mapping, otherwise grab
// its details such as the fragment with all nodes, and updates info.
const mapUpdates = (strings) => {
	let mappedTemplate = templateStrings.get(strings);
	if (!mappedTemplate) {
		mappedTemplate = mapTemplate(strings);
		templateStrings.set(strings, mappedTemplate);
	}

	const { templateNode, nodes } = mappedTemplate;
	// clone deeply the fragment
	const fragment = importNode(templateNode, true);
	// and relate an update handler per each node that needs one
	const updates = nodes.map(handlers, fragment);
	// return the fragment and all updates to use within its nodes
	return { templateNode: fragment, updates };
};

const reducePath = ({ childNodes }, i) => childNodes[i];

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

	return attribute(node, name /*, svg*/);
};

const getValue = (value) => (value == null ? value : value.valueOf());

const boolean = (node, key, oldValue) => (newValue) => {
	const value = !!getValue(newValue);
	if (oldValue !== value) {
		// when IE won't be around anymore ...
		// node.toggleAttribute(key, oldValue = !!value);
		if ((oldValue = value)) node.setAttribute(key, '');
		else node.removeAttribute(key);
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

// TODO: rename to Processors ?!
// each mapped update carries the update type and its path
// the type is either node, attribute, or text, while
// the path is how to retrieve the related node to update.
// In the attribute case, the attribute name is also carried along.
export function handlers(options) {
	const { type, path } = options;
	const node = path.reduceRight(reducePath, this);
	return type === 'node'
		? handleAnything(node)
		: type === 'attr'
		? handleAttribute(node, options.name /*, options.svg*/)
		: text(node);
}

// a RegExp that helps checking nodes that cannot contain comments
const textOnly = /^(?:textarea|script|style|title|plaintext|xmp)$/;

const empty = /^(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)$/i;
const elements = /<([a-z]+[a-z0-9:._-]*)([^>]*?)(\/?)>/g;
const attributes = /([^\s\\>"'=]+)\s*=\s*(['"]?)\x01/g;
const holes = /[\x01\x02]/g;

// \x01 Node.ELEMENT_NODE
// \x02 Node.ATTRIBUTE_NODE

/**
 * Given a template, find holes as both nodes and attributes and
 * return a string with holes as either comment nodes or named attributes.
 * @param {string[]} strings a template literal tag array
 * @param {string} prefix prefix to use per each comment/attribute
 * @returns {string} X/HTML with prefixed comments or attributes
 */
const createTemplateString = (strings, prefix) => {
	let index = 0;
	return strings
		.join('\x01')
		.trim()
		.replace(elements, (_, name, attrs, selfClosing) => {
			let ml = name + attrs.replace(attributes, '\x02=$2$1').trimEnd();
			if (selfClosing.length) ml += empty.test(name) ? ' /' : '></' + name;
			return '<' + ml + '>';
		})
		.replace(holes, (hole) => (hole === '\x01' ? '<!--' + prefix + index++ + '-->' : prefix + index++));
};

// a template is instrumented to be able to retrieve where updates are needed.
// Each unique template becomes a fragment, cloned once per each other
// operation based on the same template, i.e. data => html`<p>${data}</p>`
const mapTemplate = (strings) => {
	const templateString = createTemplateString(strings, prefix);
	const templateNode = createContent(templateString);
	// once instrumented and reproduced as fragment, it's crawled
	// to find out where each update is in the fragment tree
	const tw = createTreeWalker(templateNode, 1 | 128);
	const nodes = [];
	const length = strings.length - 1;
	let i = 0;
	// updates are searched via unique names, linearly increased across the tree
	// <div isµ0="attr" isµ1="other"><!--isµ2--><style><!--isµ3--</style></div>
	let search = `${prefix}${i}`;
	while (i < length) {
		const node = tw.nextNode();
		// if not all updates are bound but there's nothing else to crawl
		// it means that there is something wrong with the template.
		if (!node) throw `bad template: ${templateString}`;
		// if the current node is a comment, and it contains isµX
		// it means the update should take care of any content
		if (node.nodeType === 8) {
			// The only comments to be considered are those
			// which content is exactly the same as the searched one.
			if (node.data === search) {
				nodes.push({ type: 'node', path: createPath(node) });
				search = `${prefix}${++i}`;
			}
		} else {
			// if the node is not a comment, loop through all its attributes
			// named isµX and relate attribute updates to this node and the
			// attribute name, retrieved through node.getAttribute("isµX")
			// the isµX attribute will be removed as irrelevant for the layout
			// let svg = -1;
			while (node.hasAttribute(search)) {
				nodes.push({
					type: 'attr',
					path: createPath(node),
					name: node.getAttribute(search),
				});
				node.removeAttribute(search);
				search = `${prefix}${++i}`;
			}
			// if the node was a style, textarea, or others, check its content
			// and if it is <!--isµX--> then update tex-only this node
			if (textOnly.test(node.localName) && node.textContent.trim() === `<!--${search}-->`) {
				node.textContent = '';
				nodes.push({ type: 'text', path: createPath(node) });
				search = `${prefix}${++i}`;
			}
		}
	}
	// once all nodes to update, or their attributes, are known, the content
	// will be cloned in the future to represent the template, and all updates
	// related to such content retrieved right away without needing to re-crawl
	// the exact same template, and its content, more than once.
	return { templateNode, nodes };
};

// https://github.com/WebReflection/uwire
const createWire = (fragment) => {
	const { childNodes } = fragment;
	const { length } = childNodes;
	if (length < 2) return length ? childNodes[0] : fragment;
	const nodes = childNodes.slice(0);
	const firstChild = nodes[0];
	const lastChild = nodes[length - 1];
	return {
		ELEMENT_NODE,
		nodeType,
		firstChild,
		lastChild,
		valueOf() {
			if (childNodes.length !== length) {
				let i = 0;
				while (i < length) fragment.appendChild(nodes[i++]);
			}
			return fragment;
		},
	};
};

// as html and svg can be nested calls, but no parent node is known
// until rendered somewhere, the parseTemplate operation is needed to
// discover what to do with each interpolation, which will result
// into an update operation.
export const parseTemplate = (templateInfo, templateLiteral) => {
	const { strings, values } = templateLiteral;
	// interpolations can contain holes and arrays, so these need
	// to be recursively discovered
	const length = parseValues(templateInfo, values);
	let { entry } = templateInfo;
	// if the cache entry is either null or different from the template
	// and the type this parseTemplate should resolve, create a new entry
	// assigning a new content fragment and the list of updates.
	if (!entry || entry.strings !== strings) {
		templateInfo.entry = entry = createEntry(strings);
	}
	const { templateNode, updates, wire } = entry;
	// even if the fragment and its nodes is not live yet,
	// it is already possible to update via interpolations values.
	for (let i = 0; i < length; i++) {
		updates[i](values[i]);
	}
	// if the entry was new, or representing a different template or type,
	// create a new persistent entity to use during diffing.
	// This is simply a DOM node, when the template has a single container,
	// as in `<p></p>`, or a "wire" in `<p></p><p></p>` and similar cases.
	return wire || (entry.wire = createWire(templateNode));
};

// the stack retains, per each interpolation value, the cache
// related to each interpolation value, or null, if the render
// was conditional and the value is not special (TemplateLiteral or Array)
const parseValues = (templateInfo, values) => {
	const { stack } = templateInfo;
	const { length } = values;
	for (let index = 0; index < length; index++) {
		const value = values[index];
		// each TemplateLiteral gets unrolled and re-assigned as value
		// so that domdiff will deal with a node/wire and not with a TemplateLiteral
		if (value instanceof TemplateLiteral) {
			values[index] = parseTemplate(stack[index] || (stack[index] = createTemplateInfo()), value);
		}
		// arrays are recursively resolved so that each entry will contain
		// also a DOM node or a wire, hence it can be diffed if/when needed
		else if (Array.isArray(value)) {
			parseValues(stack[index] || (stack[index] = createTemplateInfo()), value);
		}
		// if the value is nothing special, the stack doesn't need to retain data
		// this is useful also to cleanup previously retained data, if the value
		// was a TemplateLiteral, or an Array, but not anymore, i.e.:
		// const update = content => html`<div>${content}</div>`;
		// update(listOfItems); update(null); update(html`hole`)
		else {
			stack[index] = null;
		}
	}
	if (length < stack.length) stack.splice(length);
	return length;
};

// TODO: these are not templates but dom nodes...
const templates = new WeakMap();
/**
 * Render a template string into the given DOM node
 * @param {TemplateLiteral | string} template
 * @param {Node} domNode
 */
const render = (template, domNode) => {
	// TODO: template could be a string ?!

	let templateInfo = templates.get(domNode);
	if (!templateInfo) {
		templateInfo = createTemplateInfo();
		templates.set(domNode, templateInfo);
	}

	// TODO: find a better name for wire...
	const wire = template instanceof TemplateLiteral ? parseTemplate(templateInfo, template) : template;
	if (wire !== templateInfo.wire) {
		templateInfo.wire = wire;
		// valueOf() simply returns the node itself, but in case it was a "wire"
		// it will eventually re-append all nodes to its fragment so that such
		// fragment can be re-appended many times in a meaningful way
		// (wires are basically persistent fragments facades with special behavior)
		domNode.replaceChildren(wire.valueOf());
	}
	//return domNode;

	// console.time('diff');
	// const templateNode = convertStringToHTML(template);
	// diffNodes(templateNode, domNode);
	// console.timeEnd('diff');
};

export { render };
