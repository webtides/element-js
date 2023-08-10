/**
 * @abstract
 */
export class Part {
	processor = undefined;

	/**
	 * @abstract
	 * @param {TemplateResult | any[] | any} value
	 */
	update(value) {}
}
