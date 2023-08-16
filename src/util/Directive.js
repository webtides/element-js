export class Directive {
	/** @type {Element} */
	node = undefined;

	/**
	 * @param {Node} node
	 */
	constructor(node) {
		this.node = node;
	}

	/**
	 * @abstract
	 */
	update() {}
}

/**
 * @param {Class<Directive>} directiveClass
 */
export const defineDirective = (directiveClass) => {
	return (...values) => {
		return { directiveClass, values };
	};
};
