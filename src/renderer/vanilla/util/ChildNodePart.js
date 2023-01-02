import { convertStringToTemplate } from '../../../util/DOMHelper.js';
import { Part } from './Part.js';
import { processNodePart } from './dom-processers.js';
import { TemplateResult } from './TemplateResult.js';
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
		if (node) this.processor = processNodePart(this.node);
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

			let parts = partsCache.get(templateResult.strings);
			if (!parts) {
				parts = templateResult.parseParts(this.fragment);
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

	valueOf() {
		// TemplateResult | Array
		return this.values ? this.values : this.fragment;
	}
}
