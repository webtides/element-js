import { processAttributePart } from './dom-processers.js';
import { Part } from './Part.js';

export class AttributePart extends Part {
	name = undefined;
	interpolations = 1;
	values = [];
	currentValueIndex = 0;
	initialValue = undefined;

	/**
	 * @param {Node} node
	 * @param {String} name
	 * @param {String} initialValue
	 */
	constructor(node, name, initialValue) {
		super(node);
		this.name = name;
		this.initialValue = initialValue;
		this.processor = processAttributePart(node.nextElementSibling, this.name);
	}

	/**
	 * @param {Node} node
	 */
	addNode(node) {
		this.interpolations++;
		// TODO: what about the comment node? It will always be the first for now...
	}

	update(value) {
		// If we only have one sole interpolation, we can just apply the update
		if (this.initialValue === '\x03') {
			super.update(value);
			return;
		}

		// Instead of applying the update immediately, we check if the part has multiple interpolations
		// and store the values for each interpolation in a list
		this.values[this.currentValueIndex++] = value;

		// Only the last call to update (for the last interpolation) will actually trigger the update
		// on the DOM processor. Here we can reset everything before the next round of updates
		if (this.interpolations === this.currentValueIndex) {
			this.currentValueIndex = 0;
			let replaceIndex = 0;
			// Note: this will coarse the values into strings, but it's probably ok since there can only be multiple values in string attributes?!
			const parsedValue = this.initialValue.replace(/\x03/g, () => this.values[replaceIndex++]);
			super.update(parsedValue);
		}
	}
}
