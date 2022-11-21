import { processPart } from './dom-processers.js';
import { Part } from './Part.js';

export class TextOnlyNodePart extends Part {
	constructor(node, value) {
		super(node, value);
		this.processor = processPart(this);
	}
}
