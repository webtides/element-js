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
		};
	}
	template() {
		return html`<div>
			Context Count: ${this.counterStore?.count ?? 0}
			<br />
			Callback: ${this.callBackCalled}
		</div>`;
	}
}
defineElement('request-context', RequestContext);
