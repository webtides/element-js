import { defineElement } from '../src/BaseElement.js';
import { TemplateElement, html } from '../src/TemplateElement.js';
import { choose, unsafeHTML } from '../src/dom-parts/directives.js';

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

    template() {
        const example = new URLSearchParams(window.location.search).get('example');

        if (example === '0') {
            return html`${this.renderArray ? this.list : this.text}`;
        }

        if (example === '00') {
            return html`${this.renderArray ? this.list : html`${this.text}`}`;
        }

        if (example === '000') {
            return html` ${this.renderArray ? this.list : html`<strong>no list</strong>`}`;
        }

        if (example === '0000') {
            return html`${this.renderArray ? html`${this.list}` : html`<strong>no list</strong>`}`;
        }

        if (example === '00000') {
            return html`<div>${unsafeHTML(`<strong>Unsafe HTML</strong>`)}</div>`;
        }

        if (example === '000000') {
            const paragraphElement = document.createElement('p');
            paragraphElement.textContent = this.text;
            return html`<div>${paragraphElement}</div>`;
        }

        if (example === '1') {
            const p = document.createElement('p');
            p.textContent = 'DOM Element';
            // rendering different things inside arrays
            return html`
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
        }

        if (example === '2') {
            return html`<div>${html`<strong>${this.text}</strong>`}</div>`;
        }

        if (example === '3') {
            const list = [];
            for (let i = 0; i < this.count; i++) {
                list.push(i);
            }

            return html`
                <ul>
                    ${list.map((item) => html`<li>${item}</li>`)}
                </ul>
            `;
        }

        if (example === '4') {
            const list = [];
            for (let i = 0; i < this.count; i++) {
                list.push(i);
            }
            return html` <div>${list.map((item) => item)}</div> `;
        }

        if (example === '5') {
            return html`<div>
                ${this.renderArray
                    ? html`<ul ref="list" data-length="${this.list.length}">
                          ${this.list.map((index) => html` <li>${index}</li>`)}
                      </ul>`
                    : html`<strong>no list</strong>`}
            </div>`;
        }

        if (example === '6') {
            const templateFn = () => {
                if (this.renderArray) {
                    return html`<ul ref="list" data-length="${this.list.length}">
                        ${this.list.map((index) => html` <li>${index}</li>`)}
                    </ul>`;
                }
                return html`<strong>no list</strong>`;
            };

            return html`<div>${templateFn()}</div>`;
        }

        if (example === '7') {
            const templateFn2 = () => {
                if (this.renderArray) {
                    return this.list.map((index) => html` <div>${index}</div>`);
                }
                return html`<strong>no list</strong>`;
            };

            return html`${templateFn2()}`;
        }

        if (example === '8') {
            return html`
                <div>
                    ${choose(this.state,{
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
                    }, null)}
                </div>
            `;
        }

        // prettier-ignore
        // return html` <div foo="${'bar'}" bar='${'baz'}' baz=${'blup'} class="link active disabled"></div> `;
        // return html`${this.text}`;
        // return html`
        // 	<div>${[unsafeHTML(`<strong>First part</strong>`), unsafeHTML(`<strong>Second part</strong>`)]}</div>
        // `;
    }
}
defineElement('example-test-element', ExampleTestElement);
