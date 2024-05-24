import { BaseElement, defineElement } from '../src/BaseElement.js';
import { TemplateElement, html } from '../src/TemplateElement.js';

class UnimportantElement extends BaseElement {}
defineElement('unimportant-element', UnimportantElement);

class DeeplyExtendedElement extends TemplateElement {
    constructor(options) {
        super(options);
    }
}

class ExampleShadowElement extends DeeplyExtendedElement {
    static baseClass = TemplateElement;

    constructor() {
        super({ shadowRender: true });
    }

    template() {
        return html` <slot></slot> `;
    }
}
defineElement('example-shadow-element', ExampleShadowElement);

class ExampleSlottedElement extends TemplateElement {
    properties() {
        return {
            name: 'John',
        };
    }

    template() {
        return html`
            <unimportant-element></unimportant-element>
            <example-shadow-element>${this.name}</example-shadow-element>
        `;
    }
}
defineElement('example-slotted-element', ExampleSlottedElement);
