/**
 * @abstract
 */
export class Part {
    /**
     * Applies the values of the template to the DOM. A part reads its own values by the index of its descriptor.
     * @abstract
     * @param {any[]} values - all values of the template
     */
    update(values) {}
}
