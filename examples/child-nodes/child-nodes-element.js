import { TemplateElement, defineElement, html, Directive, defineDirective } from '../../index.js';

const directive = defineDirective(class extends Directive {});

class ChildNodesElement extends TemplateElement {
    properties() {
        return {
            text: 'Hello',
            count: 3,
        };
    }

    template() {
        const list = [];
        for (let i = 0; i < this.count; i++) {
            list.push(i);
        }

        const p = document.createElement('p');
        p.textContent = 'DOM Element';

        const templateResult = html`
            <div>no interpolation</div>
            <div>${'single text interpolation'}</div>
            <div>${'multiple'} text ${'interpolations'}</div>
            <div>${html`template result interpolation with static text`}</div>
            <div>${html`<div>template result interpolation with html</div>`}</div>
            <ul>
                ${list.map((item) => html`<li>${item}</li>`)}
            </ul>
            <div class="test">
                ${[
                    this.count,
                    1,
                    'Text',
                    html`<span>Foo</span>`,
                    html`<span>${this.count}</span>`,
                    () => 'Function',
                    p,
                ]}
            </div>
        `;
        console.log('templateResult', templateResult.toString());
        return templateResult;
    }
}
defineElement('attributes-element', ChildNodesElement);
