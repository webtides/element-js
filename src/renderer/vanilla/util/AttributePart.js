import { processAttributePart } from './dom-processers.js';
import { Part } from './Part.js';

export class AttributePart extends Part {
	name = undefined;

	/**
	 * @param {Node} node
	 * @param {String} name
	 */
	constructor(node, name) {
		super(node);
		this.name = name;
		this.processor = processAttributePart(node.nextElementSibling, this.name);
	}
}
