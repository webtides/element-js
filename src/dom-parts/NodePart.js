import { Part } from './Part.js';
import { isObjectLike } from '../util/AttributeParser.js';

/**
 * For updating a directive on a node
 */
export class NodePart extends Part {
	/** @type {Node} */
	node = undefined;

	/** @type {Directive} */
	directive = undefined;

	/**
	 * @param {Node} node
	 * @param {() => {}} initialValue
	 */
	constructor(node, initialValue) {
		if (!isObjectLike(initialValue) && !initialValue.directiveClass) {
			throw new Error(
				'NodePart: value is not a wrapped directive function. You must wrap you custom directive class with the defineDirective function.',
			);
		}
		super();
		node.__part = this; // add Part to comment node for debugging in the browser
		this.node = node.nextElementSibling;
		const { directiveClass, values } = initialValue;
		this.directive = new directiveClass(node.nextElementSibling);
	}

	/**
	 * @param {() => {}} value
	 */
	update(value) {
		const { directiveClass, values } = value;
		this.directive.update(...values);
	}
}
