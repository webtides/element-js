import { TemplateElement, defineElement, html } from '../../index.js';
import { unsafeHTML } from '../../src/dom-parts/directives.js';

class UnsafeElement extends TemplateElement {
    properties() {
        return {
            count: 2,
        };
    }

    template() {
        return html`<div>${unsafeHTML(`<p>Unsafe HTML 1</p><strong>Unsafe HTML ${this.count}</strong>`)}</div>`;
    }
}
defineElement('unsafe-element', UnsafeElement);
