import { TemplateElement, defineElement, html } from '../../index.js';
import { spreadAttributes, optionalAttribute, when } from '../../src/dom-parts/directives.js';

class AttributeElement extends TemplateElement {
    properties() {
        return {
            label: false,
            hasAttr: false,
            hasOptional: false,
        };
    }

    template() {
        return html`<div
            ${spreadAttributes({
                foo: 'bar',
                attr: this.hasAttr ? true : null,
            })}
            ${optionalAttribute(this.hasOptional, 'optional', true)}
        >
            <div class="font-bold">${when(this.label, this.label, 'Attribute Element')}</div>
            <div>hasAttr: ${this.hasAttr}</div>
            <div>hasOptional: ${this.hasOptional}</div>
        </div>`;
    }
}
defineElement('attribute-element', AttributeElement);
