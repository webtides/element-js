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

// TODO: find a better name ?!
export class TemplateInstance {
	stack = [];
	wire = null;
	strings = undefined;
	documentFragment = undefined;
	updates = undefined;
	// TODO: wire2 because we need to be able to determine a difference in render()...
	wire2 = undefined;

	constructor(templateLiteral) {}

	// the stack retains, per each interpolation value, the cache
	// related to each interpolation value, or null, if the render
	// was conditional and the value is not special (TemplateLiteral or Array)
	parseValues(values) {
		const stack = [];
		for (let index = 0; index < values.length; index++) {
			const value = values[index];
			// each TemplateLiteral gets unrolled and re-assigned as value
			// so that domdiff will deal with a node/wire and not with a TemplateLiteral
			if (value instanceof TemplateLiteral) {
				//values[index] = parseTemplate(stack[index] || (stack[index] = createTemplateInfo()), value);
				let templateInstance = stack[index] || (stack[index] = new TemplateInstance(value));
				templateInstance.update(value);
				// TODO: it is not a good idea to manipulate values of another object/class
				values[index] = templateInstance.wire2;
			}
			// arrays are recursively resolved so that each entry will contain
			// also a DOM node or a wire, hence it can be diffed if/when needed
			else if (Array.isArray(value)) {
				//parseValues(stack[index] || (stack[index] = createTemplateInfo()), value);
				stack[index] = this.parseValues(value);
				// TODO: what about reusing previous values here?!
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
		if (values.length < stack.length) stack.splice(values.length);
		return stack;
	}

	// as html and svg can be nested calls, but no parent node is known
	// until rendered somewhere, the parseTemplate operation is needed to
	// discover what to do with each interpolation, which will result
	// into an update operation.
	update(templateLiteral) {
		// interpolations can contain holes and arrays, so these need
		// to be recursively discovered
		this.stack = this.parseValues(templateLiteral.values);

		// if the cache entry is either null or different from the template
		// and the type this parseTemplate should resolve, create a new entry
		// assigning a new content fragment and the list of updates.
		if (this.strings !== templateLiteral.strings) {
			const { documentFragment, updates } = mapUpdates(templateLiteral.strings);
			this.strings = templateLiteral.strings;
			this.documentFragment = documentFragment;
			this.updates = updates;
			this.wire2 = createWire(this.documentFragment);
		}

		// even if the fragment and its nodes is not live yet,
		// it is already possible to update via interpolations values.
		for (let i = 0; i < templateLiteral.values.length; i++) {
			this.updates[i](templateLiteral.values[i]);
		}
	}
}

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

	// clone deeply the fragment
	const documentFragment = globalThis.document?.importNode(mappedTemplate.documentFragment, true);
	// and relate an update handler per each node that needs one
	const updates = mappedTemplate.nodes.map(updateHandlers, documentFragment);
	// return the fragment and all updates to use within its nodes
	return { documentFragment, updates };
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
	const documentFragment = convertStringToTemplate(templateString);
	// once instrumented and reproduced as fragment, it's crawled
	// to find out where each update is in the fragment tree
	const tw = globalThis.document?.createTreeWalker(documentFragment, 1 | 128);
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
	return { documentFragment, nodes };
	/* NodePart ?! */
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
		// valueOf() simply returns the node itself, but in case it was a "wire"
		// it will eventually re-append all nodes to its fragment so that such
		// fragment can be re-appended many times in a meaningful way
		// (wires are basically persistent fragments facades with special behavior)
		valueOf() {
			if (childNodes.length !== length) {
				let i = 0;
				while (i < length) fragment.appendChild(nodes[i++]);
			}
			return fragment;
		},
	};
};

// TODO: these are not templates but dom nodes...
const templates = new WeakMap();

/**
 * Render a template string into the given DOM node
 * @param {TemplateLiteral | string} template
 * @param {Node} domNode
 */
const render = (template, domNode) => {
	// console.time('diff');
	// TODO: template could be a string ?!
	// TODO: make it possible that template could also be an html element ?!

	let templateInstance = templates.get(domNode);
	if (!templateInstance) {
		templateInstance = new TemplateInstance(template);
		templates.set(domNode, templateInstance);
	}

	templateInstance.update(template);

	//TODO: find a better name for wire...
	const wire = templateInstance.wire2;

	if (wire !== templateInstance.wire) {
		templateInstance.wire = wire;
		domNode.replaceChildren(wire.valueOf());
	}

	console.log('rendered');
	// console.timeEnd('diff');
};

export { render };
