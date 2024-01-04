import { COMMENT_NODE, ELEMENT_NODE } from '../util/DOMHelper.js';
import { Part } from './Part.js';
import { TemplateResult } from './TemplateResult.js';
import { TemplatePart } from './TemplatePart.js';

/**
 * @param {Node | TemplatePart | any[]} node
 * @return {ChildNode}
 */
const removeChildNodes = (node) => {
	const range = globalThis.document?.createRange();
	const firstChild = Array.isArray(node)
		? node[0]
		: node instanceof TemplatePart
		? node.childNodes[0]
		: node.firstChild;
	const lastChild = Array.isArray(node)
		? node[node.length - 1]
		: node instanceof TemplatePart
		? node.childNodes[node.childNodes.length - 1]
		: node.lastChild;
	range.setStartAfter(firstChild);
	range.setEndAfter(lastChild);
	range.deleteContents();
	return firstChild;
};

/**
 * @param {Element} commentNode
 */
const removeNodesBetweenComments = (commentNode) => {
	while (commentNode.previousSibling) {
		if (
			commentNode.previousSibling.nodeType === COMMENT_NODE &&
			commentNode.previousSibling.data === commentNode.data.replace('/', '')
		) {
			break;
		}
		commentNode.parentNode.removeChild(commentNode.previousSibling);
	}
};

/**
 * @param {Node} parentNode
 * @param {Node[]} domChildNodes
 * @param {Node[]} templateChildNodes
 * @param {Node} anchorNode
 * @return {Node[]}
 */
const diffChildNodes = function (parentNode, domChildNodes, templateChildNodes, anchorNode) {
	// Diff each node in the child node lists
	let length = Math.max(templateChildNodes.length, domChildNodes.length);
	for (let index = 0; index < length; index++) {
		let domChildNode = domChildNodes[index];
		let templateChildNode = templateChildNodes[index];

		// If the DOM node doesn't exist, append/copy the template node
		if (!domChildNode) {
			if (templateChildNode instanceof TemplatePart) {
				anchorNode.before(...templateChildNode.childNodes);
			} else if (typeof templateChildNode === 'object' && 'ELEMENT_NODE' in templateChildNode) {
				parentNode.insertBefore(templateChildNode, anchorNode);
			} else {
				// TODO: this might not be performant?! Can we maybe handle this in processDomNode?!
				// TODO: I think that we need to make ChildNodeParts from all primitive values as well
				parentNode.insertBefore(document.createTextNode(templateChildNode), anchorNode);
			}
			continue;
		}

		// If the template node doesn't exist, remove the node in the DOM
		if (!templateChildNode) {
			parentNode.removeChild(removeChildNodes(domChildNode));
			continue;
		}

		// If DOM node is equal to the template node, don't do anything
		// if (domChildNode.isEqualNode(templateChildNode)) {
		if (domChildNode === templateChildNode) {
			continue;
		}

		// TODO: everything after here does the same... do we even need to do all the checks?!
		// TODO: because if none of the checks apply, we will run into errors for later updates
		// TODO: because we return the templateNodes but they never actually get into the DOM...

		// If node types are not the same, replace the DOM node with the template node
		if (templateChildNode.nodeType !== domChildNode.nodeType) {
			parentNode.replaceChild(templateChildNode, domChildNode);
			continue;
		}

		// If the element tag names are not the same, replace the DOM node with the template node
		if (templateChildNode.nodeType === ELEMENT_NODE && templateChildNode.tagName !== domChildNode.tagName) {
			parentNode.replaceChild(templateChildNode, domChildNode);
			continue;
		}

		// If the node is an SVG element, don't even think about diffing it, just replace it
		if (templateChildNode.nodeType === ELEMENT_NODE && templateChildNode.tagName === 'SVG') {
			parentNode.replaceChild(templateChildNode, domChildNode);
			continue;
		}

		// If DOM node is not equal to the template node, replace it
		if (domChildNode !== templateChildNode) {
			parentNode.replaceChild(templateChildNode, domChildNode);
			continue;
		}
	}
	return templateChildNodes;
};

/**
 * @param {Node} comment
 * @param {TemplatePart | any[] | any} initialValue
 * @return {(function(*): void)|*}
 */
export const processNodePart = (comment, initialValue) => {
	let nodes = [];
	let oldValue = initialValue instanceof TemplatePart ? [...initialValue.childNodes] : initialValue;
	// this is for string values to be inserted into the DOM. A cached TextNode will be used so that we don't have to constantly create new DOM nodes.
	let cachedTextNode = undefined;

	const processNodeValue = (newValue) => {
		switch (typeof newValue) {
			// primitives are handled as text content
			case 'string':
			case 'number':
			case 'boolean':
				if (oldValue !== newValue) {
					oldValue = newValue;
					if (!cachedTextNode) cachedTextNode = globalThis.document?.createTextNode('');
					cachedTextNode.data = newValue;

					if (comment.previousSibling?.data === comment.data.replace('/', '')) {
						// the part is empty - we haven't rendered it yet
						comment.parentNode.insertBefore(cachedTextNode, comment);
					} else {
						// the part was already rendered (either server side or on the client)
						comment.previousSibling.data = newValue;
					}

					nodes = [cachedTextNode];
				}
				break;
			// null (= typeof "object") and undefined are used to clean up previous content
			case 'object':
			case 'undefined':
				if (newValue === null || newValue === undefined) {
					if (oldValue !== newValue) {
						oldValue = newValue;
						removeNodesBetweenComments(comment);
						nodes = [];
					}
					break;
				}
				if (Array.isArray(newValue)) {
					if (newValue.length === 0) {
						removeNodesBetweenComments(comment);
						nodes = [];
					} else {
						nodes = diffChildNodes(comment.parentNode, oldValue || [], newValue, comment);
					}
					oldValue = newValue;
					break;
				}
				// if the new value is a node or a fragment, and it's different from the live node, then it's diffed.
				if (oldValue !== newValue) {
					if ('ELEMENT_NODE' in newValue) {
						oldValue = newValue;
						nodes = diffChildNodes(comment.parentNode, nodes, [newValue], comment);
					} else if (newValue instanceof TemplatePart) {
						oldValue = newValue;
						nodes = diffChildNodes(comment.parentNode, nodes, [...newValue.childNodes], comment);
					} else {
						console.warn('Could not process value', newValue);
					}
				}
				break;
			case 'function':
				processNodeValue(newValue(comment));
				break;
		}
	};

	return processNodeValue;
};

/**
 * For updating a text node, a sequence of child nodes or an array of `any` values
 */
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

	// TODO: maybe we can store a generic vale|parsedValue that can be either parts[] | templatePart | any

	/** @type {Node[]} */
	childNodes = [];

	/**
	 * @param {Node} startNode - the start comment marker node
	 * @param {any | any[]} value
	 */
	constructor(startNode, value) {
		if (startNode && startNode?.nodeType !== COMMENT_NODE) {
			throw new Error('ChildNodePart: startNode is not a comment node');
		}

		super();

		let serverSideRendered = false;
		if (startNode) {
			startNode.__part = this; // add Part to comment node for debugging in the browser

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
			if (value instanceof TemplateResult || Array.isArray(value)) {
				this.updateParts(value);
			}

			// We need a childNodes list that is NOT live so that we don't lose elements when they get removed from the dom and we can (re)add them back in later.
			this.childNodes = [...this.childNodes];
			this.processor?.(initialValue);
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

		this.processor?.(parsedValue);
	}

	/**
	 * @param {TemplateResult | any[]} value
	 */
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
				parsedValues[index] = typeof value === 'function' ? value() : value;
			}
		}

		return parsedValues;
	}
}
