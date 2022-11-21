import { defineElement, html, TemplateElement } from '../../src/renderer/vanilla/index.js';

class RequestContext extends TemplateElement {
	constructor() {
		super({
			propertyOptions: {
				counterStore: {
					inject: true,
				},
				vanillaContext: {
					inject: true,
				},
			},
		});
	}

	properties() {
		return {
			callBackCalled: '',
			vanillaContext: '',
			counterStore: {},
		};
	}

	connected() {
		super.connected();

		this.requestContext('otherContext', (context) => {
			this.callBackCalled = context;
		});
	}

	// reactive attributes/properties

	template() {
		return html`<div>
			VIA PROP / STOREContext Count: ${this.counterStore?.count ?? 0}
			<br />
			VIA Callback: ${this.callBackCalled}
			<br />
			VIA Vanilla: ${this.vanillaContext}
		</div>`;
	}
}
defineElement('request-context', RequestContext);
