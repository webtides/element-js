import { defineElement } from '../src/BaseElement';
// import { TemplateElement, html } from '../src/TemplateElement';
// import { TemplateElement, html } from '../src/renderer/vanilla/TemplateElement.js';
import { TemplateElement, html } from '../src/renderer/uhtml/TemplateElement.js';

class ExampleInputElement extends TemplateElement {
	properties() {
		return {
			value: '',
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

	template() {
		return html`
			<div class="container mb-4 px-4">
				<div>Value: ${this.value}</div>
				<input type="text" class="border" />
			</div>
		`;
	}
}
defineElement('example-input-element', ExampleInputElement);
