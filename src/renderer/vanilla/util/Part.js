export class Part {
	node = undefined;
	value = undefined;
	processor = undefined;

	constructor(node, value) {
		this.node = node;
		this.value = value;
	}

	update(newValue, oldValue) {
		if (this.node) {
			return this.processor?.(newValue, oldValue);
		}
	}
}
