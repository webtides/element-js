import { TemplateElement, defineElement, html } from '../../index.js';

class RawTextNodeElement extends TemplateElement {
    properties() {
        return {
            text: 'Hello',
        };
    }

    template() {
        const templateResult = html`<textarea foo="${'bar'}">${this.text} bar ${'baz'}</textarea>`;
        console.log('templateResult', templateResult.toString());
        return templateResult;
    }
}
defineElement('raw-text-node-element', RawTextNodeElement);
