import { TemplateLiteral } from './html';
import { updateHandlers } from './update-handlers';
import { convertStringToTemplate, ELEMENT_NODE, getNodePath } from '../../../util/DOMHelper';

const nodeType = 111;

// the prefix is used to identify either comments, attributes, or nodes
// that contain the related unique id. In the attribute cases
// isµX="attribute-name" will be used to map current X update to that
// attribute name, while comments will be like <!--isµX-->, to map
// the update to that specific comment node, hence its parent.
// style and textarea will have <!--isµX--> text content, and are handled
// directly through text-only updates.
const prefix = 'isµ';

// a RegExp that helps checking nodes that cannot contain comments
const textOnly = /^(?:textarea|script|style|title|plaintext|xmp)$/;

const empty = /^(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)$/i;
const elements = /<([a-z]+[a-z0-9:._-]*)([^>]*?)(\/?)>/g;
const attributes = /([^\s\\>"'=]+)\s*=\s*(['"]?)\x01/g;
const holes = /[\x01\x02]/g;

// \x01 Node.ELEMENT_NODE
// \x02 Node.ATTRIBUTE_NODE

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
	const fragment = globalThis.document?.importNode(templateNode, true);
	// and relate an update handler per each node that needs one
	const updates = nodes.map(updateHandlers, fragment);
	// return the fragment and all updates to use within its nodes
	return { templateNode: fragment, updates };
};

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
	const templateNode = convertStringToTemplate(templateString);
	// once instrumented and reproduced as fragment, it's crawled
	// to find out where each update is in the fragment tree
	const tw = globalThis.document?.createTreeWalker(templateNode, 1 | 128);
	const nodes = [];
	const length = strings.length - 1;
	let i = 0;
	// updates are searched via unique names, linearly increased across the tree
	// <div isµ0="attr" isµ1="other"><!--isµ2--><style><!--isµ3--</style></div>
	let search = `${prefix}${i}`;
	// TODO: are these v ChildNodeParts and AttributeParts ?!
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
				nodes.push({ type: 'node', path: getNodePath(node) });
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
					path: getNodePath(node),
					name: node.getAttribute(search),
				});
				node.removeAttribute(search);
				search = `${prefix}${++i}`;
			}
			// if the node was a style, textarea, or others, check its content
			// and if it is <!--isµX--> then update tex-only this node
			if (textOnly.test(node.localName) && node.textContent.trim() === `<!--${search}-->`) {
				node.textContent = '';
				nodes.push({ type: 'text', path: getNodePath(node) });
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
	// interpolations can contain holes and arrays, so these need
	// to be recursively discovered
	const length = parseValues(templateInfo, templateLiteral.values);
	// if the cache entry is either null or different from the template
	// and the type this parseTemplate should resolve, create a new entry
	// assigning a new content fragment and the list of updates.
	if (!templateInfo.entry || templateInfo.entry.strings !== templateLiteral.strings) {
		templateInfo.entry = createEntry(templateLiteral.strings);
	}
	// even if the fragment and its nodes is not live yet,
	// it is already possible to update via interpolations values.
	for (let i = 0; i < length; i++) {
		templateInfo.entry.updates[i](templateLiteral.values[i]);
	}
	// if the entry was new, or representing a different template or type,
	// create a new persistent entity to use during diffing.
	// This is simply a DOM node, when the template has a single container,
	// as in `<p></p>`, or a "wire" in `<p></p><p></p>` and similar cases.
	return templateInfo.entry.wire || (templateInfo.entry.wire = createWire(templateInfo.entry.templateNode));
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

	console.log('rendered');
	// console.time('diff');
	// const templateNode = convertStringToHTML(template);
	// diffNodes(templateNode, domNode);
	// console.timeEnd('diff');
};

export { render };
