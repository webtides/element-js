export class Part {
	node = undefined;
	value = undefined;
	processor = undefined;

	/**
	 * @param {Node} node
	 * @param {any} value
	 */
	constructor(node, value) {
		this.node = node;
		this.value = value;
	}

	/**
	 * @param {any} newValue
	 * @param {any} oldValue
	 * @return {*}
	 */
	update(newValue, oldValue) {
		if (this.node) {
			return this.processor?.(newValue, oldValue);
		}
	}
}
