import { defineElement, html, TemplateElement } from '../../src/renderer/vanilla/index.js';

class RequestContext extends TemplateElement {
	properties() {
		return {
			callBackCalled: '',
		};
	}

	// reactive attributes/properties
	injectProperties() {
		return {
			counterStore: {},
			vanillaContext: '',
		};
	}

	connected() {
		super.connected();
		// make callback requests implicit
		this.requestContext('otherContext', (context) => {
			this.callBackCalled = context;
		});
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
