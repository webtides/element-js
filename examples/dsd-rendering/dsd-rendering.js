import { TemplateElement, defineElement, html, Store } from '../../index.js';

class ShadowElement extends TemplateElement {
	constructor() {
		super({ shadowRender: true });
	}

	template() {
		return html` <div>client side shadow root content</div> `;
	}
}

defineElement('shadow-element', ShadowElement);
