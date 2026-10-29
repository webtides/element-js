import { isWholeValue, joinValues } from './values.js';
import { createWriter } from './writers.js';

/**
 * One attribute of an element with one or more interpolations: `class="${a} ${b}"`, `?disabled="${flag}"`,
 * `.value="${text}"`, `@click="${listener}"`.
 */
export class AttributePart {
    /** @type {import('./parseTemplate.js').AttributeDescriptor} */
    descriptor;

    /** @type {boolean} the binding is the whole attribute value and keeps the type of its value */
    whole;

    /** @type {(value: any) => void} */
    write;

    /**
     * @param {Element} element
     * @param {import('./parseTemplate.js').AttributeDescriptor} descriptor
     */
    constructor(element, descriptor) {
        this.descriptor = descriptor;
        this.whole = isWholeValue(descriptor);
        this.write = createWriter(element, descriptor);
    }

    /**
     * @param {any[]} values
     */
    update(values) {
        const { index, strings } = this.descriptor;
        this.write(this.whole ? values[index] : joinValues(strings, values, index));
    }
}
