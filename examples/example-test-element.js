import { defineElement } from '../src/BaseElement';
// import { TemplateElement, html } from '../src/TemplateElement';
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
		for (let i = 0; i <= this.count; i++) {
			list.push(i);
		}
		/*
		<div foo="${this.foo}" bar="${this.bar}">
				${this.text}
				<div class="test">${list.map((item) => html` <div index="${item}">${this.text} - ${item}</div> `)}</div>
			</div>
		 */
		return html`
			<div class="test">${list.map((item) => html` <div index="${item}">${this.text} - ${item}</div> `)}</div>
		`;
	}
}
defineElement('example-test-element', ExampleTestElement);
