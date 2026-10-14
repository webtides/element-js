/**
 * @abstract
 */
export class Part {
    processor = undefined;

    /**
     * Applies a value to the DOM.
     * @abstract
     * @param {TemplateResult | any[] | any} value
     */
    update(value) {}

    /**
     * Takes over server rendered DOM for the first client side value. The default applies the value. Parts whose
     * value has a representation in the server markup override this and keep the server state until the next update.
     * @param {TemplateResult | any[] | any} value
     */
    hydrate(value) {
        this.update(value);
    }
}
