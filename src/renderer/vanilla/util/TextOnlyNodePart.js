import { Part } from './Part.js';

export class TextOnlyNodePart extends Part {
	constructor(node, value) {
		super(node, value);
		// TODO: this is not used right now right?! Find a use and implement it correctly!
		this.processor = text(this.node);
	}
}
