import { COMMENT_NODE, convertStringToTemplate, getNodePath } from '../../../util/DOMHelper.js';
import { Part } from './Part.js';
import { processPart } from './dom-processers.js';
import { prefix, TemplateResult, textOnly } from './TemplateResult.js';
import { PersistentFragment } from './PersistentFragment.js';
import { AttributePart } from './AttributePart.js';
import { TextOnlyNodePart } from './TextOnlyNodePart.js';

const partsCache = new WeakMap();
const fragmentsCache = new WeakMap();

export class ChildNodePart extends Part {
	// Used to remember parent template state as we recurse into nested templates
	parts = [];
	strings = undefined;

	fragment = undefined; // PersistentFragment
	values = undefined;

	// commentNode, TemplateResult | array, PersistentFragment
	constructor(node, value, fragment) {
		super(node, value);
		this.fragment = fragment;
		this.value = this.parseValue(value);
		if (node) this.processor = processPart(this);
	}

	parseValue(value) {
		if (Array.isArray(value)) {
			return this.parseArray(value);
		}
		if (value instanceof TemplateResult) {
			this.parseTemplateResult(value);
			return this.fragment;
		}
		return value;
	}

	update(value) {
		if (value instanceof TemplateResult || Array.isArray(value)) {
			const parsedValue = this.parseValue(value);
			const parsedOldValue = this.value;
			this.value = parsedValue;

			const values = Array.isArray(value) ? value : value.values;

			for (let index = 0; index < values.length; index++) {
				// TODO: parts and values might have different lengths?!
				this.parts[index].update(values[index]);
			}

			// TODO: is this really doing the right thing?!
			return super.update(parsedValue, parsedOldValue);
		} else {
			return super.update(value);
		}
	}

	// nested TemplateResults values need to be unrolled in order for update functions to be able to process them
	parseArray(values) {
		const parsedValues = [];
		for (let index = 0; index < values.length; index++) {
			let value = values[index];
			const node = this.fragment?.childNodes?.[index];

			if (value instanceof TemplateResult || Array.isArray(value)) {
				let childNodePart = this.parts[index];
				if (!childNodePart) {
					childNodePart = new ChildNodePart(
						undefined, // TODO
						value,
						node ? new PersistentFragment([node]) : undefined,
					);
					this.parts[index] = childNodePart;
				} else {
					childNodePart.parseValue(value);
				}

				parsedValues[index] = childNodePart.valueOf();
			} else {
				parsedValues[index] = value;
			}
		}

		return parsedValues;
	}

	parseTemplateResult(templateResult) {
		if (this.strings !== templateResult.strings) {
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
					const placeholder = node.data;

					const childNodes = [];
					let childNode = node.nextSibling;
					while (childNode && childNode.data !== `/${placeholder}`) {
						childNodes.push(childNode);
						childNode = childNode.nextSibling;
					}

					const endCommentMarker = childNode?.data === `/${placeholder}` ? childNode : node;

					const fragment = new PersistentFragment(childNodes);
					return new ChildNodePart(endCommentMarker, templateResult.values[index], fragment);
				}
				if (part.type === 'attribute') {
					return new AttributePart(node, part.name);
				}
				if (part.type === 'text') {
					return new TextOnlyNodePart(node, templateResult.values[index]);
				}

				throw `cannot map part: ${part}`;
			});
			this.strings = templateResult.strings;
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

		// TODO: if attributes had comment nodes as well we could omit traversing all normal elements and just loop over comments - should be way faster...
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

	valueOf() {
		// TemplateResult | Array
		return this.values ? this.values : this.fragment;
	}
}
