import { COMMENT_NODE, ELEMENT_NODE } from '../../../util/DOMHelper.js';
import { Part } from './Part.js';
import { processNodePart } from './dom-processers.js';
import { TemplateResult } from './TemplateResult.js';
import { TemplatePart } from './TemplatePart.js';

export class ChildNodePart extends Part {
	/** @type {Node | undefined} */
	startNode = undefined;

	/** @type {Node | undefined} */
	endNode = undefined;

	// TODO: this is only for array values
	/** @type {Part[]} */
	parts = [];

	// TODO: this is only for TemplatePart values
	templatePart = undefined;

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
	 * @param {any | any[]} value
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

			this.childNodes = childNodes;
			this.startNode = startNode;
			this.endNode = endNode;
		}

		// value can become array | TemplatePart | any
		const initialValue = this.parseValue(value);

		if (this.endNode) {
			this.processor = processNodePart(this.endNode, serverSideRendered ? initialValue : undefined);
		}

		if (!serverSideRendered) {
			// TODO: it would be better to be able to simply call this.update() here!
			if (initialValue instanceof TemplatePart) {
				this.templatePart.update(value);
			}

			if (Array.isArray(value)) {
				this.updateParts(value);
			}

			// We need a childNodes list that is NOT live so that we don't lose elements when they get removed from the dom and we can (re)add them back in later.
			this.childNodes = [...this.childNodes];
			super.update(initialValue);
		}
	}

	/**
	 * @param {any} value
	 * @return {*}
	 */
	update(value) {
		const parsedValue = this.parseValue(value);

		if (value instanceof TemplateResult || Array.isArray(value)) {
			this.updateParts(value);
		}

		// TODO: call domProcessro directly here to make it clear what is going on
		return super.update(parsedValue);
	}

	updateParts(value) {
		if (value instanceof TemplateResult) {
			this.templatePart.update(value);
		}
		if (Array.isArray(value)) {
			for (let index = 0; index < value.length; index++) {
				this.parts[index]?.update(value[index]);
			}
		}
	}

	/**
	 * @param {TemplateResult | any[] | any} value
	 * @return {TemplatePart | any[] | any}
	 */
	parseValue(value) {
		if (value instanceof TemplateResult) {
			if (!this.templatePart) {
				const templatePartCommentNodes = this.childNodes?.filter(
					(node) => node && node.nodeType === COMMENT_NODE && node.data === 'template-part',
				);
				const startNode = templatePartCommentNodes[0];
				this.templatePart = new TemplatePart(startNode, value);
			}
			return this.templatePart;
		}
		if (Array.isArray(value)) {
			return this.parseArray(value);
		}
		return value;
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

			if (value instanceof TemplateResult) {
				let templatePart = this.parts[index];
				if (!templatePart) {
					const templatePartCommentNodes = this.childNodes?.filter(
						(node) => node && node.nodeType === COMMENT_NODE && node.data === 'template-part',
					);
					const startNode = templatePartCommentNodes[index];
					templatePart = new TemplatePart(startNode, value);
					this.parts[index] = templatePart;
				}
				parsedValues[index] = templatePart;
			} else if (Array.isArray(value)) {
				let childNodePart = this.parts[index];
				if (!childNodePart) {
					// TODO: this seems not correct :(
					const templatePartCommentNodes = this.childNodes?.filter(
						(node) => node && node.nodeType === COMMENT_NODE && node.data === 'template-part',
					);
					const startNode = templatePartCommentNodes[index];
					childNodePart = new ChildNodePart(startNode, value);
					this.parts[index] = childNodePart;
				}
				parsedValues[index] = childNodePart;
			} else {
				parsedValues[index] = value;
			}
		}

		return parsedValues;
	}
}
