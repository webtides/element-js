import { defineElement } from '../src/BaseElement';
import { TemplateElement, html } from '../src/TemplateElement.js';

class ExampleTestElement extends TemplateElement {
    constructor() {
        super();
    }

    properties() {
        return {
            count: 1,
            foo: '',
            bar: '',
            text: '',
            list: [1],
            renderArray: true,
        };
    }

    template() {
        const list = [];
        for (let i = 0; i < this.count; i++) {
            list.push(i);
        }
        const p = document.createElement('p');
        p.textContent = 'DOM Element';
        // return html`
        // 	<div class="test">
        // 		${[this.count, 1, 'Text', html`<span>Foo</span>`, html`<span>${this.count}</span>`, () => 'Function', p]}
        // 	</div>
        // `;
        // return html`<div>${html`<strong>${this.text}</strong>`}</div>`;
        // return html`
        // 	<ul>
        // 		${list.map((item) => html`<li>${item}</li>`)}
        // 	</ul>
        // `;
        // return html`
        // 	<div>
        // 		${list.map((item) => item)}
        // 	</div>
        // `;

        // return html`<ul ref="list">
        //     ${this.list.map((index) => html` <li>${index}</li>`)}
        // </ul>`;

        return html`<div>
            ${this.renderArray
            ? html`<ul ref="list" data-length="${this.list.length}">
                      ${this.list.map((index) => html` <li>${index}</li>`)}
                  </ul>`
            : html`<strong>no list</strong>`}
        </div>`;
        // prettier-ignore
        // return html` <div foo="${'bar'}" bar='${'baz'}' baz=${'blup'} class="link active disabled"></div> `;
        // return html`${this.text}`;
        // return html`
        // 	<div>${[unsafeHTML(`<strong>First part</strong>`), unsafeHTML(`<strong>Second part</strong>`)]}</div>
        // `;
    }
}
defineElement('example-test-element', ExampleTestElement);
