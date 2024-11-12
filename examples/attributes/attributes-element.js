import { TemplateElement, defineElement, html, Directive, defineDirective } from '../../index.js';

const directive = defineDirective(class extends Directive {});

class AttributesElement extends TemplateElement {
    properties() {
        return {
            text: 'Hello',
        };
    }

    template() {
        const templateResult = html`
            <div foo1="bar" class="before:block before:content-['Festivus']">no interpolation</div>
            <div foo2="${'bar'}">single attribute interpolation</div>
            <div foo3="${'bar'}" bar="${'baz'}">multiple attribute interpolations</div>
            <div foo4="${'bar'} baz ${'foo'} before:content-['Festivus']">
                multiple interpolations in single attribute
            </div>
            <div ?true-boolean="${true}" ?false-boolean="${false}">boolean attributes</div>
            <div .data=${JSON.stringify({ foo: 'bar' })} .list="${JSON.stringify(['foo', 'bar'])}">
                property attributes .data and .list
            </div>
            <div @click="${() => console.log('clicked')}">@event listener attribute</div>
            <div no-directive ${directive()}>directive interpolation</div>
        `;
        console.log('templateResult', templateResult.toString());
        return templateResult;
    }
}
defineElement('attributes-element', AttributesElement);
