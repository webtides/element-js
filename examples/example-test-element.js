import { defineElement } from '../src/BaseElement.js';
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
            list: [1, 2],
            renderArray: true,
            state: 'initial',
        };
    }

    renderState(states) {
        if (this.state === 'initial') return null;
        return states[this.state];
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

        // return html`<div>
        //     ${this.renderArray
        //     ? html`<ul ref="list" data-length="${this.list.length}">
        //               ${this.list.map((index) => html` <li>${index}</li>`)}
        //           </ul>`
        //     : html`<strong>no list</strong>`}
        // </div>`;

        // const templateFn = () => {
        //     if (this.renderArray) {
        //         return html`<ul ref="list" data-length="${this.list.length}">
        //             ${this.list.map((index) => html` <li>${index}</li>`)}
        //         </ul>`;
        //     }
        //     return html`<strong>no list</strong>`;
        // };
        //
        // const templateFn2 = () => {
        //     if (this.renderArray) {
        //         return this.list.map((index) => html` <li>${index}</li>`);
        //     }
        //     return html`<strong>no list</strong>`;
        // };
        //
        // return html`<div>
        //     ${templateFn2()}
        // </div>`;

        return html`
            <div>
                ${this.renderState({
                    loading: html`
                        <div class="bg-gray-500 p-4">
                            <p class="m-0">Loading ...</p>
                        </div>
                    `,
                    result: html`
                        <div class="bg-gray-500 p-4">
                            <p class="m-0">Result</p>
                        </div>
                    `,
                })}
            </div>
        `;
        // prettier-ignore
        // return html` <div foo="${'bar'}" bar='${'baz'}' baz=${'blup'} class="link active disabled"></div> `;
        // return html`${this.text}`;
        // return html`
        // 	<div>${[unsafeHTML(`<strong>First part</strong>`), unsafeHTML(`<strong>Second part</strong>`)]}</div>
        // `;
    }
}
defineElement('example-test-element', ExampleTestElement);
