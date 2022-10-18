import { TemplateLiteral } from './html';
import { processPart } from './processers';
import {
	convertStringToTemplate,
	PERSISTENT_DOCUMENT_FRAGMENT_NODE,
	getNodePath,
	ELEMENT_NODE, COMMENT_NODE
} from "../../../util/DOMHelper";

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

// Template Literals are unique per scope and static, meaning a template
// should be parsed once, and once only, as it will always represent the same
// content, within the exact same amount of updates each time.
// This cache relates each template to its unique content and updates.
const nodeParts = new WeakMap();

// TODO: find a better name for TemplateInstance ?!
// Maybe TemplatePart ?!
export class TemplateInstance {
	fragment = null; // PersistentFragment
	strings = undefined;
	templateInstances = [];
	updates = undefined;

	constructor(templateLiteral) {
		this.update(templateLiteral);
	}

	// as html and svg can be nested calls, but no parent node is known
	// until rendered somewhere, the parseTemplate operation is needed to
	// discover what to do with each interpolation, which will result
	// into an update operation.
	update(templateLiteral) {
		// if the cache entry is either null or different from the template
		// and the type this parseTemplate should resolve, create a new entry
		// assigning a new content fragment and the list of updates.
		if (this.strings !== templateLiteral.strings) {
			// if a template is unknown, perform the previous mapping, otherwise grab
			// its details such as the fragment with all nodes, and updates info.
			let nodePart = nodeParts.get(templateLiteral.strings);
			if (!nodePart) {
				nodePart = new NodePart(templateLiteral.strings);
				nodeParts.set(templateLiteral.strings, nodePart);
			}

			// clone deeply the fragment
			const documentFragment = globalThis.document?.importNode(nodePart.documentFragment, true);
			// and relate an update handler per each node that needs one
			const updates = nodePart.parts.map(processPart, documentFragment);

			this.strings = templateLiteral.strings;
			this.updates = updates;
			this.fragment = new PersistentFragment(documentFragment);
		}

		const values = this.parseValues(templateLiteral.values);
		// even if the fragment and its nodes is not live yet,
		// it is already possible to update via interpolations values.
		for (let index = 0; index < values.length; index++) {
			this.updates[index](values[index]);
		}
	}

	parseValues(values) {
		for (let index = 0; index < values.length; index++) {
			let value = values[index];

			// each TemplateLiteral gets unrolled and re-assigned as value
			// so that domdiff will deal with a node/wire and not with a TemplateLiteral
			if (value instanceof TemplateLiteral) {
				let templateInstance = this.templateInstances[index];
				if (!templateInstance) {
					templateInstance = new TemplateInstance(value);
					this.templateInstances[index] = templateInstance;
				} else {
					templateInstance.update(value);
				}
				values[index] = templateInstance.fragment;
			} else if (Array.isArray(value)) {
				// TODO: these nested values are not cached... :(
				values[index] = this.parseValues(value);
			}
		}

		return values;
	}
}

export class Part {
	node = undefined;
	path = undefined;

	constructor(node) {
		this.node = node;
		this.path = getNodePath(node);
	}
}
export class AttributePart extends Part {
	name = undefined;

	constructor(node, name) {
		super(node);
		this.name = name;
	}
}
export class ChildNodePart extends Part {}
export class TextNodePart extends Part {}

export class NodePart {
	documentFragment = undefined;
	parts = [];

	constructor(strings) {
		const templateString = this.createTemplateString(strings, prefix);
		this.documentFragment = convertStringToTemplate(templateString);

		// once instrumented and reproduced as fragment, it's crawled
		// to find out where each update is in the fragment tree
		const tw = globalThis.document?.createTreeWalker(this.documentFragment, 1 | 128);
		const parts = [];
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
			if (node.nodeType === COMMENT_NODE) {
				// The only comments to be considered are those
				// which content is exactly the same as the searched one.
				if (node.data === search) {
					parts.push(new ChildNodePart(node));
					search = `${prefix}${++i}`;
				}
			} else {
				// if the node is not a comment, loop through all its attributes
				// named isµX and relate attribute updates to this node and the
				// attribute name, retrieved through node.getAttribute("isµX")
				// the isµX attribute will be removed as irrelevant for the layout
				// let svg = -1;
				while (node.hasAttribute(search)) {
					parts.push(new AttributePart(node, node.getAttribute(search)));
					node.removeAttribute(search);
					search = `${prefix}${++i}`;
				}
				// if the node was a style, textarea, or others, check its content
				// and if it is <!--isµX--> then update tex-only this node
				if (textOnly.test(node.localName) && node.textContent.trim() === `<!--${search}-->`) {
					node.textContent = '';
					parts.push(new TextNodePart(node));
					search = `${prefix}${++i}`;
				}
			}
		}
		// once all nodes to update, or their attributes, are known, the content
		// will be cloned in the future to represent the template, and all updates
		// related to such content retrieved right away without needing to re-crawl
		// the exact same template, and its content, more than once.
		this.parts = parts;
		//return { documentFragment, nodes };
	}

	/**
	 * Given a template, find holes as both nodes and attributes and
	 * return a string with holes as either comment nodes or named attributes.
	 * @param {string[]} strings a template literal tag array
	 * @param {string} prefix prefix to use per each comment/attribute
	 * @returns {string} X/HTML with prefixed comments or attributes
	 */
	createTemplateString(strings, prefix) {
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
	}
}

// https://github.com/whatwg/dom/issues/736
// TODO: maybe I can actually extend the real DocumentFragment? So that I don't have to patch everything else...
/**
 * Keeps the references of child nodes after they have been added/inserted into a real document
 * other than a "normal" Fragment that will be empty after such operations
 */
export class PersistentFragment {
	fragment = undefined;
	childNodes = []; // "not live" copy of childNodes

	constructor(fragment) {
		this.fragment = fragment;
		this.childNodes = [...fragment.childNodes];
	}

	get ELEMENT_NODE() {
		return ELEMENT_NODE;
	}

	get nodeType() {
		return PERSISTENT_DOCUMENT_FRAGMENT_NODE;
	}

	get firstChild() {
		return this.childNodes[0];
	}

	get lastChild() {
		return this.childNodes[this.childNodes.length - 1];
	}

	// valueOf() simply returns the node itself, but in case it was a "wire"
	// it will eventually re-append all nodes to its fragment so that such
	// fragment can be re-appended many times in a meaningful way
	// (wires are basically persistent fragments facades with special behavior)
	// TODO: maybe rename this to "content" ?! https://developer.mozilla.org/en-US/docs/Web/API/HTMLTemplateElement#instance_properties
	valueOf() {
		if (this.fragment.childNodes.length !== this.childNodes.length) {
			let i = 0;
			while (i < this.childNodes.length) this.fragment.appendChild(this.childNodes[i++]);
		}
		return this.fragment;
	}
}

/**
 * Render a template string into the given DOM node
 * @param {TemplateLiteral | string} template
 * @param {Node} domNode
 */
const render = (template, domNode) => {
	console.time('diff');
	// TODO: template could be a string ?!
	// TODO: make it possible that template could also be an html element ?!

	template.renderInto(domNode);

	// console.log('rendered');
	console.timeEnd('diff');
};

export { render };
