import { ElementPart } from './ElementPart.js';
import { joinValues } from './values.js';

/**
 * The content of a raw text element, `<style>`, `<script>`, `<textarea>` or `<title>`, with one or more
 * interpolations. The browser parses no markup in there, the whole content is written as one text.
 */
export class TextContentPart extends ElementPart {
    /**
     * @param {any[]} values
     * @return {string}
     */
    valueFrom(values) {
        const { index, strings } = this.descriptor;
        return joinValues(strings, values, index);
    }

    read() {
        return this.element.textContent;
    }

    /**
     * @param {string} text
     */
    write(text) {
        this.element.textContent = text;
    }
}
