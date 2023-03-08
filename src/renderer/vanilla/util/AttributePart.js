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

	// Maybe we can return an attribute part multiple times?
	// and when calling the update method on the part, it will batch and only actually call the processor
	// when all updates where set?!
	// but how will the part know how many updates it has to wait for?
	// it will probably have a string with the static values in it along with some kind of placeholders
	// the amount of placeholders should be that number?
}
