import { TemplateResult } from './html';
import { processPart } from './processers';
import {
	COMMENT_NODE,
	convertStringToTemplate,
	ELEMENT_NODE,
	getNodePath,
	PERSISTENT_DOCUMENT_FRAGMENT_NODE,
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
	// Used to remember parent template state as we recurse into nested templates
	parts = [];
	strings = undefined;

	fragment = undefined; // PersistentFragment
	values = undefined;

	// TemplateResult | array, PersistentFragment
	constructor(templateResult, fragment) {
		this.fragment = fragment;
		this.prepare(templateResult);
	}

	prepare(templateResult) {
		if (Array.isArray(templateResult)) {
			//templateResult as values
			this.values = this.parseValues(templateResult);
		} else if (this.strings !== templateResult.strings) {
			if (!this.fragment) {
				let fragment = fragmentsCache.get(templateResult.strings);
				if (!fragment) {
					fragment = this.parseFragment(templateResult);
					fragmentsCache.set(templateResult.strings, fragment);
				}
				this.fragment = new PersistentFragment(fragment);
			}

			// TODO: maybe we can move this into TemplateResult?!
			// But then it would run on the server... :(
			// Maybe we can move it there, but not run it on creation but only when requested...
			// But then we would still have to shim things like TreeWalker and DocumentFragment right?!
			let parts = partsCache.get(templateResult.strings);
			if (!parts) {
				parts = this.parseParts(templateResult, this.fragment);
				partsCache.set(templateResult.strings, parts);
			}

			this.parts = parts.map((part, index) => {
				// We currently need the path because the fragment will be cloned via importNode and therefore the node will be a different one
				const node = part.path.reduceRight(({ childNodes }, i) => childNodes[i], this.fragment);

				if (part.type === 'node') {
					return new ChildNodePart(node, templateResult.values[index]);
				}
				if (part.type === 'attribute') {
					return new AttributePart(node, part.name);
				}
				if (part.type === 'text') {
					return new TextNodePart(node, templateResult.values[index]);
				}

				throw `cannot map part: ${part}`;
			});
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

	// PersistentFragment
	parseParts(templateResult, fragment) {
		// we always create a template fragment so that we can start at the root for traversing the node path
		// TODO: for real dom we need to specify a limit/end node
		const template = globalThis.document?.createDocumentFragment();
		for (const childNode of fragment.childNodes) {
			// TODO: maybe use a range to create a fragment faster?!
			template.append(childNode.cloneNode(true));
		}

		const tw = globalThis.document?.createTreeWalker(template, 1 | 128);
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
				console.log('bad template:', templateResult, fragment);
				throw `bad template: ${templateResult.templateString}`;
			}

			if (node.nodeType === COMMENT_NODE) {
				if (node.data === `${placeholder}`) {
					// TODO: do we need markers for parts inside arrays ?! (like lit)
					// https://lit.dev/playground/#sample=examples/repeating-and-conditional

					// TODO: instead of ChildNode, lets also create TemplateParts here?!
					// therefore we probably need a comment/marker node around the template right?!
					parts.push({ type: 'node', path: getNodePath(node) });
					// TODO: ^ could we also start parsing the stack recursively?!
					placeholder = `${prefix}${++i}`;
				}
			} else {
				while (node.hasAttribute(placeholder)) {
					parts.push({ type: 'attribute', path: getNodePath(node), name: node.getAttribute(placeholder) });
					// the placeholder attribute can be removed once we have our part for processing updates
					//node.removeAttribute(placeholder);
					placeholder = `${prefix}${++i}`;
				}
				// if the node is a text-only node, check its content for a placeholder
				if (textOnly.test(node.localName) && node.textContent.trim() === `<!--${placeholder}-->`) {
					node.textContent = '';
					// TODO: add example to test this case...
					parts.push({ type: 'text', path: getNodePath(node) });
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
			const node = this.fragment?.childNodes?.[index];

			if (value instanceof TemplateResult || Array.isArray(value)) {
				let templatePart = this.parts[index];
				if (!templatePart) {
					templatePart = new TemplatePart(value, node ? new PersistentFragment([node]) : undefined);
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
	processor = undefined;

	constructor(node, value) {
		this.node = node;
		this.value = value;
	}

	update(newValue, oldValue = this.value) {
		return this.processor?.(newValue, oldValue);
	}
}

export class AttributePart extends Part {
	name = undefined;

	// TODO: this is the actual node
	constructor(node, name) {
		super(node);
		this.name = name;
		this.processor = processPart(this);
	}
}

// TODO: TemplatePart and ChildNodePart seem to be kind of the same?!
// after merging, lets name it NodePart ?!
export class ChildNodePart extends Part {
	templatePart = undefined;
	fragment = undefined;

	// TODO: this is the comment node
	constructor(node, value) {
		const placeholder = node.data;

		const childNodes = [];
		let childNode = node.nextSibling;
		while (childNode && childNode.data !== `/${placeholder}`) {
			childNodes.push(childNode);
			childNode = childNode.nextSibling;
		}

		const endCommentMarker = childNode?.data === `/${placeholder}` ? childNode : node;

		super(endCommentMarker, value);
		this.fragment = new PersistentFragment(childNodes);
		this.processor = processPart(this);
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
}

export class TextNodePart extends Part {
	constructor(node, value) {
		super(node, value);
		this.processor = processPart(this);
	}
}

// https://github.com/whatwg/dom/issues/736
// TODO: maybe I can actually extend the real DocumentFragment? So that I don't have to patch everything else...
/**
 * Keeps the references of child nodes after they have been added/inserted into a real document
 * other than a "normal" Fragment that will be empty after such operations
 */
export class PersistentFragment {
	// TODO: maybe name it ^ something like NodeGroup ?!
	// TODO: I think we can get rid of this ^ if we simply store childNodes[] on TemplatePart/ChildNodePart
	childNodes = []; // "not live" copy of childNodes

	constructor(node) {
		if (node instanceof DocumentFragment) {
			const fragment = globalThis.document?.importNode(node, true);
			this.childNodes = [...fragment.childNodes];
		} else if (Array.isArray(node)) {
			this.childNodes = [...node];
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
