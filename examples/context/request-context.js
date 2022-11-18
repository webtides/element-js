import { defineElement, html, TemplateElement } from '../../src/renderer/vanilla/index.js';

class RequestContext extends TemplateElement {
	properties() {
		return {
			callBackCalled: '',
		};
	}
	// reactive attributes/properties
	context() {
		return {
			counterStore: {},
			otherContext: (context) => {
				this.callBackCalled = context;
			},
			vanillaContext: '',
		};
	}
	template() {
		return html`<div>
			Context Count: ${this.counterStore?.count ?? 0}
			<br />
			Callback: ${this.callBackCalled}
			<br />
			Vanilla: ${this.vanillaContext}
		</div>`;
	}
}
defineElement('request-context', RequestContext);
