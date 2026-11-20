// marks that the part has not read the DOM yet
const NOT_SET = Symbol('not set');

/**
 * A binding on an element: an attribute, a property, a listener or the text content of a raw text element. The part
 * takes the value of its binding from the values of the template, compares it with the value it wrote last and only
 * writes a change. Before its first write it reads the value from the DOM once: a fresh clone has nothing there and
 * gets written, server rendered markup that fits already is left alone.
 * @abstract
 */
export class ElementPart {
    /** @type {Element} */
    element;

    /** @type {import('./parseTemplate.js').Descriptor} */
    descriptor;

    /** @type {any} the value written last, or the value in the DOM before the first write */
    oldValue = NOT_SET;

    /**
     * @param {Element} element
     * @param {import('./parseTemplate.js').Descriptor} descriptor
     */
    constructor(element, descriptor) {
        this.element = element;
        this.descriptor = descriptor;
    }

    /**
     * @param {any[]} values - all values of the template
     */
    update(values) {
        const value = this.valueFrom(values);
        if (this.oldValue === NOT_SET) this.oldValue = this.read();
        if (value === this.oldValue) return;
        this.write(value);
        this.oldValue = value;
    }

    /**
     * The value of the binding, as it is compared and written.
     * @param {any[]} values - all values of the template
     * @return {any}
     */
    valueFrom(values) {
        return values[this.descriptor.index];
    }

    /**
     * The value in the DOM before the first write. A part that cannot read its value has the first value written.
     * @return {any}
     */
    read() {
        return NOT_SET;
    }

    /**
     * Writes a changed value. `oldValue` still holds the value written before.
     * @abstract
     * @param {any} value
     */
    write(value) {}
}
