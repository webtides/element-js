import { COMMENT_NODE, convertStringToTemplate } from '../../../util/DOMHelper.js';
import { Part } from './Part.js';
import { processNodePart } from './dom-processers.js';
import { TemplateResult } from './TemplateResult.js';
import { PersistentFragment } from './PersistentFragment.js';
import { AttributePart } from './AttributePart.js';

/** @type {Map<TemplateStringsArray, Part[]>} */
const partsCache = new WeakMap();

// TODO: don't allow DocumentFragments to be inserted here
/** @type {Map<TemplateStringsArray, PersistentFragment | DocumentFragment>} */
const fragmentsCache = new WeakMap();

export class ChildNodePart extends Part {
	/** @type {Node | undefined} */
	startNode = undefined;

	/** @type {Node | undefined} */
	endNode = undefined;

	/** @type {Part[]} */
	parts = [];

	/** @type {TemplateStringsArray} */
	strings = undefined;

	/** @type {PersistentFragment} */
	fragment = undefined;

	/**
	 * @param {Node} startNode - the start comment marker node
	 * @param {TemplateResult | any[]} value
	 */
	constructor(startNode, value) {
		if (startNode && startNode?.nodeType !== COMMENT_NODE) {
			throw new Error('ChildNodePart: startNode is not a comment node');
		}

		super(startNode);

		let serverSideRendered = false;
		if (startNode) {
			const placeholder = startNode.data;
			const childNodes = [startNode];
			let childNode = startNode.nextSibling;
			while (childNode && childNode.data !== `/${placeholder}`) {
				childNodes.push(childNode);
				childNode = childNode.nextSibling;
			}

			const endNode = childNode;
			childNodes.push(endNode);

			// if not SSRed, childNodes will only ever have two comment nodes, the start and the end marker
			if (childNodes.length > 2) {
				serverSideRendered = true;
			}

			this.fragment = new PersistentFragment(childNodes);
			this.startNode = startNode;
			this.endNode = endNode;
		}
		const initialValue = this.parseValue(value);
		if (this.endNode) {
			this.processor = processNodePart(this.endNode, serverSideRendered ? initialValue : undefined);
			if (!serverSideRendered) super.update(initialValue);
		}
	}

	/**
	 * @param {TemplateResult | any[] | any} value
	 * @return {any[] | PersistentFragment | any}
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
		const parsedValue = this.parseValue(value);
		if (value instanceof TemplateResult || Array.isArray(value)) {
			const values = Array.isArray(value) ? value : value.values;

			for (let index = 0; index < values.length; index++) {
				this.parts[index]?.update(values[index]);
			}
		}
		return super.update(parsedValue);
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
						(node) => node && node.nodeType === COMMENT_NODE && node.data === 'template-part',
					);
					const startNode = templatePartCommentNodes[index];

					childNodePart = new ChildNodePart(startNode, value);
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

			// TODO: maybe move this as method somewhere else?!
			/** @type AttributePart */
			let previousAttributePart = undefined;
			this.parts = parts.map((part, index) => {
				// We currently need the path because the fragment will be cloned via importNode and therefore the node will be a different one
				const node = part.path.reduceRight(({ childNodes }, i) => childNodes[i], this.fragment);

				if (part.type === 'node') {
					return new ChildNodePart(node, templateResult.values[index]);
					// TODO: the nodes in the parts array also have nested parts information... we could start creating the nested parts here as well
				}
				if (part.type === 'attribute') {
					// If we have multiple attribute parts with the same name, it means we have multiple
					// interpolations inside that attribute. Instead of creating a new part, we will return the same
					// as before and let it defer the update until the last interpolation gets updated
					if (previousAttributePart && previousAttributePart.name === part.name) {
						previousAttributePart.addNode(node);
						return previousAttributePart;
					}
					return (previousAttributePart = new AttributePart(node, part.name, part.initialValue));
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
