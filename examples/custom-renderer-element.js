import { TemplateElement, html, defineElement } from '../src/renderer/vanilla';

class CustomRendererElement extends TemplateElement {
	properties() {
		return {
			name: 'John',
			items: 1,
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
			</div>
		`;
	}
}
defineElement('custom-renderer-element', CustomRendererElement);
