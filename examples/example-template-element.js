import { defineElement } from '../src/BaseElement';
import { TemplateElement, html } from '../src/TemplateElement';

class ExampleTemplateElement extends TemplateElement {
	properties() {
		return {
			name: 'John',
			items: 1,
			array: [1, 2, 3, 4],
		};
	}

	get listItems() {
		const items = [];
		for (let index = 0; index < this.items; index++) {
			items.push(index);
		}
		return items;
	}

	template() {
		return html`
			<div class="parent">
				<div class="child">${this.name}</div>
				<ul>
					${this.listItems.map((item) => html` <li>${item}</li> `)}
				</ul>
				<div>${this.array.map((item) => html` <div>${item}</div> `)}</div>
			</div>
		`;
	}
}
defineElement('example-template-element', ExampleTemplateElement);
