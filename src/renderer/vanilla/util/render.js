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

const partsCache = new WeakMap();
const fragmentsCache = new WeakMap();

export class TemplatePart {
	fragment = null; // PersistentFragment
	strings = undefined;
	// Used to remember parent template state as we recurse into nested templates
	templateParts = {}; // stack = []
	updates = undefined;

	constructor(templateResult) {
		this.update(templateResult);
	}

	hydrate(templateResult) {
		if (this.strings !== templateResult.strings) {
			let fragment = fragmentsCache.get(templateResult.strings);
			if (!fragment) {
				fragment = this.parseFragment(templateResult);
				fragmentsCache.set(templateResult.strings, fragment);
			}

			let parts = partsCache.get(templateResult.strings);
			if (!parts) {
				parts = this.parseParts(templateResult, fragment);
				partsCache.set(templateResult.strings, parts);
			}

			// TODO: for SSR I think we need to use a fragment?! from the live dom instead of the cached fragment here...
			this.fragment = new PersistentFragment(fragment);
			this.updates = parts.map((part) => processPart(part, this.fragment.fragment));
			this.strings = templateResult.strings;
		}
	}

	update(templateResult) {
		this.hydrate(templateResult);

		const values = this.parseValues(templateResult.values);

		for (let index = 0; index < values.length; index++) {
			this.updates[index](values[index]);
		}
	}

	parseFragment(templateResult) {
		const templateString = templateResult.templateString;
		return convertStringToTemplate(templateString);
	}

	parseParts(templateResult, documentFragment) {
		const tw = globalThis.document?.createTreeWalker(documentFragment, 1 | 128);
		const parts = [];
		const length = templateResult.strings.length - 1;
		let i = 0;
		let placeholder = `${prefix}${i}`;
		// search for parts through numbered placeholders
		// <div isµ0="attribute" isµ1="another-attribute"><!--isµ2--><span><!--isµ3--</span></div>
		while (i < length) {
			const node = tw.nextNode();

			if (!node) throw `bad template: ${templateResult.templateString}`;

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
		return parts;
	}

	// nested TemplateResults values need to be unrolled in order for update functions to be able to process them
	parseValues(values, parentIndex = undefined) {
		for (let index = 0; index < values.length; index++) {
			let value = values[index];

			if (value instanceof TemplateResult) {
				let templateInstance = this.templateParts[`${parentIndex}_${index}`];
				if (!templateInstance) {
					templateInstance = new TemplatePart(value);
					this.templateParts[`${parentIndex}_${index}`] = templateInstance;
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
		this.fragment = globalThis.document?.importNode(fragment, true);
		this.childNodes = [...this.fragment.childNodes];
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
