import { COMMENT_NODE, convertStringToTemplate } from '../../../util/DOMHelper.js';
import { Part } from './Part.js';
import { TemplateResult } from './TemplateResult.js';
import { AttributePart } from './AttributePart.js';
import { ChildNodePart } from './ChildNodePart.js';

/** @type {Map<TemplateStringsArray, Part[]>} */
const partsCache = new WeakMap();

/** @type {Map<TemplateStringsArray, DocumentFragment>} */
const fragmentsCache = new WeakMap();

export class TemplatePart extends Part {
	/** @type {Part[]} */
	parts = [];

	/** @type {TemplateStringsArray} */
	strings = undefined;

	/** @type {Node[]} */
	childNodes = [];

	// TODO: get rid of this...
	get ELEMENT_NODE() {
		return ELEMENT_NODE;
	}

	// TODO: get rid of this...
	get firstChild() {
		return this.childNodes[0];
	}

	// TODO: get rid of this...
	get lastChild() {
		return this.childNodes[this.childNodes.length - 1];
	}

	/**
	 * @param {Node} startNode - the start comment marker node
	 * @param {TemplateResult} value
	 */
	constructor(startNode, value) {
		if (startNode && startNode?.nodeType !== COMMENT_NODE) {
			throw new Error('TemplatePart: startNode is not a comment node');
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
		}

		this.parseValue(value);

		if (!serverSideRendered) {
			this.updateParts(value.values);
			// We need a childNodes list that is NOT live so that we don't loose elements when they get removed from the dom and we can (re)add them back in later.
			this.childNodes = [...this.childNodes];
		}
	}

	/**
	 * @param {TemplateResult} value
	 */
	update(value) {
		this.parseValue(value);
		this.updateParts(value.values);
	}

	/**
	 * @param {any[]} values
	 */
	updateParts(values) {
		for (let index = 0; index < values.length; index++) {
			this.parts[index]?.update(values[index]);
		}
	}

	/**
	 * @param {TemplateResult} templateResult
	 */
	parseValue(templateResult) {
		if (this.strings !== templateResult.strings) {
			// TODO: for nested TemplateResults the fragment seems to be wrong
			// and won't get updated ever again...
			// TODO: the || check should not be needed :(
			// but if the nested TemplateResult has values the strings will never ever be rendered...
			// if (!this.fragment || templateResult.values.length === 0) {
			if (this.childNodes.length === 0 || templateResult.values.length === 0) {
				let fragment = fragmentsCache.get(templateResult.strings);
				if (!fragment) {
					fragment = this.parseFragment(templateResult);
					fragmentsCache.set(templateResult.strings, fragment);
				}
				const importedFragment = globalThis.document?.importNode(fragment, true);
				this.childNodes = importedFragment.childNodes;
			}

			let parts = partsCache.get(templateResult.strings);
			if (!parts) {
				parts = templateResult.parseParts(this.childNodes);
				partsCache.set(templateResult.strings, parts);
			}

			/** @type AttributePart */
			let previousAttributePart = undefined;
			this.parts = parts.map((part, index) => {
				// We currently need the path because the fragment will be cloned via importNode and therefore the node will be a different one
				const node = part.path.reduceRight(({ childNodes }, i) => childNodes[i], this);

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
}
