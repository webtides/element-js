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
// attributes: dom-part-1="attribute-name"
// nodes|fragments|arrays (as comment nodes): <!--dom-part-2-->
const prefix = 'dom-part-';

// match nodes|elements that cannot contain comment nodes and must be handled via text-only updates directly.
const textOnly = /^(?:textarea|script|style|title|plaintext|xmp)$/;

const partsCache = new WeakMap();
const fragmentsCache = new WeakMap();

// Interpolation?! Substitution?! Value?! Hole?!
export class TemplatePart {
	node = undefined;
	// Used to remember parent template state as we recurse into nested templates
	parts = [];
	strings = undefined;

	fragment = null; // PersistentFragment
	values = undefined;

	// TemplateResult | array
	constructor(templateResult, node) {
		this.node = node;
		this.prepare(templateResult);
	}

	prepare(templateResult) {
		if (Array.isArray(templateResult)) {
			//templateResult as values
			this.values = this.parseValues(templateResult);
		} else if (this.strings !== templateResult.strings) {
			// TODO: this must only be done when there is no this.node
			let fragment = fragmentsCache.get(templateResult.strings);
			if (!fragment) {
				fragment = this.parseFragment(templateResult);
				fragmentsCache.set(templateResult.strings, fragment);
			}

			this.fragment = new PersistentFragment(this.node || fragment);

			let parts = partsCache.get(templateResult.strings);
			if (!parts) {
				// TODO: here we can use (cloned) fragments
				parts = this.parseParts(templateResult, { childNodes: this.fragment.childNodes });
				partsCache.set(templateResult.strings, parts);
			}

			// TODO: here we need to use the real dom!
			// TODO: and cloning must also do recursive/nested cloning
			this.parts = parts.map((part) => part.clone({ childNodes: this.fragment.childNodes }));
			this.strings = templateResult.strings;
		}
	}

	update(templateResult) {
		this.prepare(templateResult);

		const values = Array.isArray(templateResult) ? templateResult : templateResult.values;

		for (let index = 0; index < values.length; index++) {
			// TODO: parts and values might have different lengths?!
			this.parts[index].update(values[index]);
		}
	}

	parseFragment(templateResult) {
		const templateString = templateResult.templateString;
		return convertStringToTemplate(templateString);
	}

	parseParts(templateResult, rootNode) {
		// we always create a fragment so that we can start at the root for traversing the node path
		const fragment = globalThis.document?.createDocumentFragment();
		for (const childNode of rootNode.childNodes) {
			fragment.append(childNode.cloneNode(true));
		}

		const tw = globalThis.document?.createTreeWalker(fragment, 1 | 128);
		const parts = [];
		const length = templateResult.strings.length - 1;
		let i = 0;
		let placeholder = `${prefix}${i}`;
		// search for parts through numbered placeholders
		// <div dom-part-0="attribute" dom-part-1="another-attribute"><!--dom-part-2--><span><!--dom-part-3--</span></div>
		while (i < length) {
			const node = tw.nextNode();

			// TODO: this is not a good way to handle this...
			// because the template string looks perfectly fine - it is rather not a real DocumentFragment?!
			if (!node) {
				console.log('bad template:', templateResult, rootNode);
				throw `bad template: ${templateResult.templateString}`;
			}

			if (node.nodeType === COMMENT_NODE) {
				if (node.data === `${placeholder}`) {
					// TODO: do we need markers for parts inside arrays ?! (like lit)
					// https://lit.dev/playground/#sample=examples/repeating-and-conditional

					// TODO: maybe name it something like NodeGroup ?!
					const childNodes = [];
					let childNode = node.nextSibling;
					while (childNode && childNode.data !== `/${placeholder}`) {
						childNodes.push(childNode);
						childNode = childNode.nextSibling;
					}

					parts.push(
						new ChildNodePart(
							// childNode?.data === `/${placeholder}` ? childNode : node,
							node,
							templateResult.values[i],
							{ childNodes },
						),
					);
					placeholder = `${prefix}${++i}`;
				}
			} else {
				while (node.hasAttribute(placeholder)) {
					parts.push(new AttributePart(node, node.getAttribute(placeholder)));
					// the placeholder attribute can be removed once we have our part for processing updates
					//node.removeAttribute(placeholder);
					placeholder = `${prefix}${++i}`;
				}
				// if the node is a text-only node, check its content for a placeholder
				if (textOnly.test(node.localName) && node.textContent.trim() === `<!--${placeholder}-->`) {
					node.textContent = '';
					// TODO: add example to test this case...
					parts.push(new TextNodePart(node));
					placeholder = `${prefix}${++i}`;
				}
			}
		}
		return parts;
	}

	// nested TemplateResults values need to be unrolled in order for update functions to be able to process them
	parseValues(values) {
		const parsedValues = [];
		for (let index = 0; index < values.length; index++) {
			let value = values[index];
			const node = this.node?.childNodes?.[index];

			if (value instanceof TemplateResult || Array.isArray(value)) {
				let templatePart = this.parts[index];
				if (!templatePart) {
					templatePart = new TemplatePart(value, node ? { childNodes: [node] } : undefined);
					this.parts[index] = templatePart;
				} else {
					templatePart.update(value);
				}

				parsedValues[index] = templatePart.valueOf();
			} else {
				parsedValues[index] = value;
			}
		}

		return parsedValues;
	}

	valueOf() {
		// TemplateResult | Array
		return this.values ? this.values : this.fragment;
	}
}

export class Part {
	node = undefined;
	value = undefined;
	path = undefined;
	processor = undefined;

	constructor(node, value) {
		this.node = node;
		this.value = value;
		this.path = getNodePath(node);
		// TODO: for real dom we need to specify a limit/end node
	}

	update(newValue, oldValue = this.value) {
		return this.processor?.(newValue, oldValue);
	}

	clone(fragment) {
		const clonedPart = new this.constructor(this.node);
		clonedPart.processor = processPart(clonedPart, fragment);
		return clonedPart;
	}
}

export class AttributePart extends Part {
	name = undefined;

	constructor(node, name) {
		super(node);
		this.name = name;
	}

	clone(fragment) {
		// We currently need the path because the fragment will be cloned via importNode and therefore the node will be a different one
		const node = this.path.reduceRight(({ childNodes }, i) => childNodes[i], fragment);
		const clonedPart = new AttributePart(node, this.name);
		clonedPart.processor = processPart(clonedPart);
		return clonedPart;
	}
}

export class ChildNodePart extends Part {
	templatePart = undefined;
	fragment = undefined;

	constructor(node, value, fragment) {
		super(node, value);
		this.fragment = fragment;
		this.parseValue(value);
	}

	update(newValue) {
		const parsedValue = this.parseValue(newValue);
		const parsedOldValue = this.parseValue(this.value);
		this.value = newValue;
		this.templatePart?.update(newValue);
		return super.update(parsedValue, parsedOldValue);
	}

	// nested TemplateResults values need to be unrolled in order for update functions to be able to process them
	// TODO: I don't like that we do parse values here and in TemplatePart/ValuePart...
	parseValue(value) {
		if (value instanceof TemplateResult || Array.isArray(value)) {
			let templatePart = this.templatePart;
			if (!templatePart) {
				templatePart = new TemplatePart(value, this.fragment);
				this.templatePart = templatePart;
			} else {
				templatePart.update(value);
			}

			return templatePart.valueOf();
		}
		return value;
	}

	clone(fragment) {
		// We currently need the path because the fragment will be cloned via importNode and therefore the node will be a different one
		const startCommentMarker = this.path.reduceRight(({ childNodes }, i) => childNodes[i], fragment);

		const placeholder = startCommentMarker.data;
		// TODO: maybe name it something like NodeGroup ?!
		const childNodes = [];
		let childNode = startCommentMarker.nextSibling;
		while (childNode && childNode.data !== `/${placeholder}`) {
			childNodes.push(childNode);
			childNode = childNode.nextSibling;
		}

		const endCommentMarker = childNode?.data === `/${placeholder}` ? childNode : startCommentMarker;

		const clonedPart = new ChildNodePart(endCommentMarker, this.value, { childNodes });
		clonedPart.processor = processPart(clonedPart);
		return clonedPart;
	}
}

export class TextNodePart extends Part {}

// https://github.com/whatwg/dom/issues/736
// TODO: maybe I can actually extend the real DocumentFragment? So that I don't have to patch everything else...
/**
 * Keeps the references of child nodes after they have been added/inserted into a real document
 * other than a "normal" Fragment that will be empty after such operations
 */
export class PersistentFragment {
	childNodes = []; // "not live" copy of childNodes

	// TODO: this does not have a name yet...
	// just a pojo { childNodes: [] }
	constructor(node) {
		if (node instanceof DocumentFragment) {
			const fragment = globalThis.document?.importNode(node, true);
			this.childNodes = [...fragment.childNodes];
		} else {
			this.childNodes = [...node.childNodes];
		}
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

	template.renderInto(domNode);

	console.timeEnd('diff');
};

export { render };
