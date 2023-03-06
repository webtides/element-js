import { COMMENT_NODE, convertStringToTemplate } from '../../../util/DOMHelper.js';
import { Part } from './Part.js';
import { processNodePart } from './dom-processers.js';
import { TemplateResult } from './TemplateResult.js';
import { PersistentFragment } from './PersistentFragment.js';
import { AttributePart } from './AttributePart.js';
import { TextOnlyNodePart } from './TextOnlyNodePart.js';

/** @type {Map<TemplateStringsArray, Part[]>} */
const partsCache = new WeakMap();

// TODO: don't allow DocumentFragments to be inserted here
/** @type {Map<TemplateStringsArray, PersistentFragment | DocumentFragment>} */
const fragmentsCache = new WeakMap();

export class ChildNodePart extends Part {
	/** @type {Part[]} */
	parts = []; // Used to remember parent template state as we recurse into nested templates

	// TODO: instead of using the strings array, we should use a hash of the strings maybe?
	/** @type {TemplateStringsArray} */
	strings = undefined;

	/** @type {PersistentFragment} */
	fragment = undefined;

	/**
	 * @param {Node} node - the comment node
	 * @param {TemplateResult | any[]} value
	 * @param {PersistentFragment | undefined} fragment
	 */
	constructor(node, value, fragment) {
		// TODO: if SSRed, we probably need to set the value?!
		super(node, undefined);
		this.fragment = fragment;
		this.parseValue(value);
		if (node) this.processor = processNodePart(this.node);
	}

	/**
	 * @param {TemplateResult | any[]} value
	 * @return {any[] | PersistentFragment}
	 */
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

	/**
	 * @param {any} value
	 * @return {*}
	 */
	update(value) {
		if (value instanceof TemplateResult || Array.isArray(value)) {
			// TODO: when doing it for the first time, parseValue will be done twice.. (1. in constructor)
			const parsedValue = this.parseValue(value);
			// TODO: because it was already parsed in the constructor, old and new values will be the same...
			const parsedOldValue = this.value;
			this.value = parsedValue;

			const values = Array.isArray(value) ? value : value.values;

			for (let index = 0; index < values.length; index++) {
				this.parts[index].update(values[index]);
			}

			// TODO: is this really doing the right thing?!
			// Maybe so! There are two kind of ChildNode Parts - Node Parts and Array Parts
			// The Array parts won't have a comment node and therefore also don't have a processor
			// but the Node Parts have a comment node and a processor and the update is the actual call
			// to actually render anything to the DOM.
			return super.update(parsedValue, parsedOldValue);
		} else {
			return super.update(value);
		}
	}

	/**
	 * Nested TemplateResults values need to be unrolled in order for update functions to be able to process them
	 * @param {any[]} values
	 * @return {any[]}
	 */
	parseArray(values) {
		const parsedValues = [];
		for (let index = 0; index < values.length; index++) {
			let value = values[index];

			if (value instanceof TemplateResult || Array.isArray(value)) {
				let childNodePart = this.parts[index];
				if (!childNodePart) {
					const templatePartCommentNodes = this.fragment?.childNodes?.filter(
						(node) => node.nodeType === 8 && node.data === 'template-part',
					);
					const startCommentMarker = templatePartCommentNodes[index];

					if (startCommentMarker) {
						const childNodes = [startCommentMarker];
						let childNode = startCommentMarker.nextSibling;
						while (childNode && childNode.data !== `/template-part`) {
							childNodes.push(childNode);
							childNode = childNode.nextSibling;
						}
						const endCommentMarker = childNode?.data === `/template-part` ? childNode : startCommentMarker;
						childNodes.push(endCommentMarker);
						const fragment = new PersistentFragment(childNodes);
						childNodePart = new ChildNodePart(endCommentMarker, value, fragment);
					} else {
						childNodePart = new ChildNodePart(undefined, value, undefined);
					}
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

	/**
	 * @param {TemplateResult} templateResult
	 */
	parseTemplateResult(templateResult) {
		if (this.strings !== templateResult.strings) {
			// TODO: for nested TemplateResults the fragment seems to be wrong
			// and won't get updated ever again...
			// TODO: the || check should not be needed :(
			// but if the nested TemplateResult has values the strings will never ever be rendered...
			if (!this.fragment || templateResult.values.length === 0) {
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

					const childNodes = [node];
					let childNode = node.nextSibling;
					while (childNode && childNode.data !== `/${placeholder}`) {
						childNodes.push(childNode);
						childNode = childNode.nextSibling;
					}

					const endCommentMarker = childNode;
					childNodes.push(endCommentMarker);

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

	/**
	 * @param {TemplateResult} templateResult
	 * @return {DocumentFragment}
	 */
	parseFragment(templateResult) {
		const templateString = templateResult.templateString;
		return convertStringToTemplate(templateString);
	}

	/**
	 * @return {any[] | PersistentFragment}
	 */
	valueOf() {
		// TemplateResult | Array
		return Array.isArray(this.value) ? this.value : this.fragment;
	}
}
