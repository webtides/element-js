import { TemplateElement, defineElement, html } from '../../index.js';

class RawTextNodeElement extends TemplateElement {
    properties() {
        return {
            text: 'Hello',
        };
    }

    template() {
        return html`<textarea foo="${'bar'}">${this.text} bar ${'baz'}</textarea>`;
    }
}
defineElement('raw-text-node-element', RawTextNodeElement);
