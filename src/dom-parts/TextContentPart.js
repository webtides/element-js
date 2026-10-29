import { joinValues } from './values.js';
import { textContentWriter } from './writers.js';

/**
 * The content of a raw text element, `<style>`, `<script>`, `<textarea>` or `<title>`, with one or more
 * interpolations. The browser parses no markup in there, the whole content is written as one text.
 */
export class TextContentPart {
    /** @type {import('./parseTemplate.js').TextDescriptor} */
    descriptor;

    /** @type {(text: string) => void} */
    write;

    /**
     * @param {Element} element
     * @param {import('./parseTemplate.js').TextDescriptor} descriptor
     */
    constructor(element, descriptor) {
        this.descriptor = descriptor;
        this.write = textContentWriter(element);
    }

    /**
     * @param {any[]} values
     */
    update(values) {
        const { index, strings } = this.descriptor;
        this.write(joinValues(strings, values, index));
    }
}
