import { defineElement } from '../src/BaseElement';
import { TemplateElement, html } from '../src/TemplateElement';

class TestElement extends TemplateElement {
    properties() {
        return { text: '' };
    }

    template() {
        return html`<div>Text: ${this.text}</div>`;
    }
}
defineElement('test-element', TestElement);

class ExampleInputElement extends TemplateElement {
    properties() {
        return {
            value: '',
            foo: false,
            bar: true,
        };
    }

    events() {
        return {
            input: {
                keyup: (e) => {
                    this.value = e.target.value;
                },
            },
        };
    }

    disabledChanged(e) {
        console.log('disabledChanged', this, e);
        // TODO: "this" is not correct... it is the input element rather than the custom element class :(
        this.foo = e.target.checked;
    }

    template() {
        return html`
            <div class="container mb-4 px-4">
                <div>Keep Focus: ${this.value}</div>
                <input type="text" class="border" />
                <div ?foo=${this.foo} ?bar=${this.bar}>Boolean attribute:</div>
                <label>
                    <input type="checkbox" @change="${this.disabledChanged}" />
                    Disabled
                </label>
                <test-element .text="${this.value}"></test-element>
            </div>
        `;
    }
}
defineElement('example-input-element', ExampleInputElement);
