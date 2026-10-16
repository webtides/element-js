/**
 * @abstract
 */
export class Part {
    processor = undefined;

    /**
     * Applies a value to the DOM.
     * @abstract
     * @param {TemplateResult | any[] | any} value
     * @param {boolean} [hydrate] - first update of server rendered DOM, nested parts bind to the server rendered markers
     */
    update(value, hydrate = false) {}
}
