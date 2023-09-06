import { defineElement } from '../../src/BaseElement.js';
import { TemplateElement, html } from '../../src/TemplateElement.js';

class ShadowElement extends TemplateElement {
	constructor(options) {
		super({ shadowRender: true, adoptGlobalStyles: false, ...options });
	}

	template() {
		return html`
			<style>
				:host {
					display: flex;
					gap: 16px;
					flex-wrap: wrap;
				}
				div {
					background: red;
					color: white;
					padding: 16px;
					margin-bottom: 16px;
				}
			</style>
			<div class="document-adopted">document-adopted</div>
			<div class="head-style">head-style</div>
			<div class="head-link">head-link</div>
			<div class="body-style">body-style</div>
			<div class="body-link">body-link</div>
			<div class="async-head-style">async-head-style</div>
			<div class="async-head-link">async-head-link</div>
			<div class="async-body-style">async-body-style</div>
			<div class="async-body-link">async-body-link</div>
		`;
	}
}

class StyledShadowElement extends ShadowElement {
	constructor() {
		super({ adoptGlobalStyles: true });
	}
}

class AdoptOneStyleShadowElement extends ShadowElement {
	constructor() {
		super({ adoptGlobalStyles: '#globalStyles1' });
	}
}

class AdoptMultipleStylesShadowElement extends ShadowElement {
	constructor() {
		super({ adoptGlobalStyles: ['document', '#globalStyles1', '.globalStyles2', '[async-style]'] });
	}
}

defineElement('shadow-element', ShadowElement);
defineElement('styled-shadow-element', StyledShadowElement);
defineElement('adopt-one-style-shadow-element', AdoptOneStyleShadowElement);
defineElement('adopt-multiple-styles-shadow-element', AdoptMultipleStylesShadowElement);
