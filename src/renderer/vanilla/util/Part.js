export class Part {
	node = undefined;
	processor = undefined;

	/**
	 * @param {Node} node
	 */
	constructor(node) {
		this.node = node;
	}

	/**
	 * @param {any} value
	 * @return {*}
	 */
	update(value) {
		if (this.processor) {
			return this.processor?.(value);
		}
	}
}
