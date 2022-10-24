import { TemplateResult } from './html';
import { processPart } from './processers';
import {
	convertStringToTemplate,
	PERSISTENT_DOCUMENT_FRAGMENT_NODE,
	getNodePath,
	ELEMENT_NODE,
	COMMENT_NODE,
} from '../../../util/DOMHelper';

// the prefix is used to tag and reference nodes and attributes to create parts with updates
// attributes: isµ1="attribute-name"
// nodes (as comment nodes): <!--isµ2-->
// TODO: us a different prefix...
const prefix = 'isµ';

// match nodes|elements that cannot contain comment nodes and must be handled via text-only updates directly.
const textOnly = /^(?:textarea|script|style|title|plaintext|xmp)$/;
const empty = /^(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)$/i;
const elements = /<([a-z]+[a-z0-9:._-]*)([^>]*?)(\/?)>/g;
const attributes = /([^\s\\>"'=]+)\s*=\s*(['"]?)\x01/g;
// TODO: find a better name for holes...
const holes = /[\x01\x02]/g;

// \x01 Node.ELEMENT_NODE
// \x02 Node.ATTRIBUTE_NODE

const nodeParts = new WeakMap();

// TODO: find a better name for TemplateInstance ?!
// Maybe TemplatePart ?!
export class TemplateInstance {
	fragment = null; // PersistentFragment
	strings = undefined;
	// Used to remember parent template state as we recurse into nested templates
	templateInstances = {}; // stack = []
	updates = undefined;

	constructor(templateResult) {
		this.update(templateResult);
	}

	hydrate(templateResult) {
		if (this.strings !== templateResult.strings) {
			let nodePart = nodeParts.get(templateResult.strings);
			if (!nodePart) {
				nodePart = new NodePart(templateResult.strings);
				nodeParts.set(templateResult.strings, nodePart);
			}

			const documentFragment = globalThis.document?.importNode(nodePart.documentFragment, true);
			const updates = nodePart.parts.map(processPart, documentFragment);

			this.strings = templateResult.strings;
			// TODO: I think I would rather like to only store the parts here and the parts should carry updates by them self
			// and then recursively call the updates from/via the parts
			this.updates = updates;
			this.fragment = new PersistentFragment(documentFragment);
		}
	}

	update(templateResult) {
		this.hydrate(templateResult);

		const values = this.parseValues(templateResult.values);

		for (let index = 0; index < values.length; index++) {
			this.updates[index](values[index]);
		}
	}

	// nested TemplateResults values need to be unrolled in order for update functions to be able to process them
	parseValues(values, parentIndex = undefined) {
		for (let index = 0; index < values.length; index++) {
			let value = values[index];

			if (value instanceof TemplateResult) {
				let templateInstance = this.templateInstances[`${parentIndex}_${index}`];
				if (!templateInstance) {
					templateInstance = new TemplateInstance(value);
					this.templateInstances[`${parentIndex}_${index}`] = templateInstance;
				} else {
					templateInstance.update(value);
				}
				values[index] = templateInstance.fragment;
			} else if (Array.isArray(value)) {
				values[index] = this.parseValues(value, `${parentIndex}_${index}`);
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

// TODO: TemplateInstance and NodePart are kind of the same?! Or need to be switched?! Or some of their behaviour must be switched?!
export class NodePart {
	documentFragment = undefined;
	parts = [];

	constructor(strings) {
		const templateString = this.createTemplateString(strings, prefix);
		this.documentFragment = convertStringToTemplate(templateString);

		const tw = globalThis.document?.createTreeWalker(this.documentFragment, 1 | 128);
		const parts = [];
		const length = strings.length - 1;
		let i = 0;
		let placeholder = `${prefix}${i}`;
		// search for parts through numbered placeholders
		// <div isµ0="attribute" isµ1="another-attribute"><!--isµ2--><span><!--isµ3--</span></div>
		while (i < length) {
			const node = tw.nextNode();

			if (!node) throw `bad template: ${templateString}`;

			if (node.nodeType === COMMENT_NODE) {
				if (node.data === placeholder) {
					parts.push(new ChildNodePart(node));
					placeholder = `${prefix}${++i}`;
				}
			} else {
				while (node.hasAttribute(placeholder)) {
					parts.push(new AttributePart(node, node.getAttribute(placeholder)));
					// the placeholder attribute can be removed once we have our part for processing updates
					node.removeAttribute(placeholder);
					placeholder = `${prefix}${++i}`;
				}
				// if the node is a text-only node, check its content for a placeholder
				if (textOnly.test(node.localName) && node.textContent.trim() === `<!--${placeholder}-->`) {
					node.textContent = '';
					parts.push(new TextNodePart(node));
					placeholder = `${prefix}${++i}`;
				}
			}
		}
		this.parts = parts;
	}

	/**
	 * find interpolations in the given template for nodes and attributes and
	 * return a string with placeholders as either comment nodes or named attributes.
	 * @param {string[]} strings a template literal tag array
	 * @param {string} prefix prefix to use per each comment/attribute
	 * @returns {string} template with tagged placeholders for values
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

	// appending or inserting the fragment, moves the nodes into the DOM, leaving behind an empty DocumentFragment
	// therefore we cache the nodes and re-append them whenever the fragment is needed again.
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
 * @param {TemplateResult | string} template
 * @param {Node} domNode
 */
const render = (template, domNode) => {
	// TODO: template could be a string ?!
	// TODO: make it possible that template could also be an html element ?!
	console.time('diff');

	//console.log('toString()', template.toString());
	template.renderInto(domNode);

	// TODO: hydrate instead of render...
	// Ich hab zwei Möglichkeiten
	// entweder ich gehe per TreeWalker über das live DOM (das muss das endgame/ ultimative Ziel sein)
	// oder ich gehe wieder über das Fragement aus dem String (das wäre aber unnötig) und mache aber KEINE updates
	// Das end result muss immer sein, dass ich eine Liste mit Updates bekomme und die persistent fragments die referenzen aus dem DOM enthalten

	console.timeEnd('diff');
};

export { render };
