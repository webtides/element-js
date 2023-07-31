import { defineElement } from '../src/BaseElement';
import { TemplateElement, html } from '../src/renderer/vanilla/TemplateElement.js';

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
		};
	}

	template() {
		const list = [];
		for (let i = 0; i < this.count; i++) {
			list.push(i);
		}
		const p = document.createElement('p');
		p.textContent = 'DOM Element';
		/*<div class="test">
				${[...list, 1, 'Text', html`<span>Foo</span>`, html`<span>${this.count}</span>`, () => 'Function', p]}
			</div>*/
		//return html` ${'<span>Test</span>'} `;
		// return html`
		// 	<ul>
		// 		${list.map((item) => html`<li>${item}</li>`)}
		// 	</ul>
		// `;
		// prettier-ignore
		// return html` <div foo="${'bar'}" bar='${'baz'}' baz=${'blup'} class="link active disabled"></div> `;
		return html`${this.text}`;
	}
}
defineElement('example-test-element', ExampleTestElement);
