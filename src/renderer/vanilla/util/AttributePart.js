import { processPart } from './dom-processers.js';
import { Part } from './Part.js';

export class AttributePart extends Part {
	name = undefined;

	// TODO: this is the actual node
	constructor(node, name) {
		super(node);
		this.name = name;
		this.processor = processPart(this);
	}
}
