import { Part } from './Part.js';
import { joinValues, valuesChanged } from './values.js';

const NOT_SET = Symbol('not set');

/**
 * The content of a raw text element, `<style>`, `<script>`, `<textarea>` or `<title>`, with one or more
 * interpolations. The browser parses no markup in there, the whole content is written as one text.
 */
export class TextContentPart extends Part {
    /** @type {Element} */
    element;

    /** @type {import('./parseTemplate.js').TextDescriptor} */
    descriptor;

    /** @type {any[] | undefined} the values of the last update */
    lastValues = undefined;

    /** @type {string | typeof NOT_SET} the content that was written last */
    oldValue = NOT_SET;

    /**
     * @param {Element} element
     * @param {import('./parseTemplate.js').TextDescriptor} descriptor
     */
    constructor(element, descriptor) {
        super();
        this.element = element;
        this.descriptor = descriptor;
    }

    /**
     * @param {any[]} values
     */
    update(values) {
        const { index, span, strings } = this.descriptor;
        if (!valuesChanged(this.lastValues, values, index, span)) return;
        this.lastValues = values.slice(index, index + span);
        const content = joinValues(strings, values, index);
        // the first update compares with the DOM once, server rendered content that fits is left alone
        if (this.oldValue === NOT_SET && this.element.textContent === content) {
            this.oldValue = content;
            return;
        }
        if (this.oldValue === content) return;
        this.oldValue = content;
        this.element.textContent = content;
    }
}
