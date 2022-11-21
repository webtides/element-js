import { processAttributePart } from './dom-processers.js';
import { Part } from './Part.js';

export class AttributePart extends Part {
	name = undefined;

	// TODO: this is the actual node and not a comment like for the other parts...
	constructor(node, name) {
		super(node);
		this.name = name;
		this.processor = processAttributePart(this.node, this.name);
	}
}
