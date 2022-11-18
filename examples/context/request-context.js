import { defineElement, html, TemplateElement } from '../../src/renderer/vanilla/index.js';

class RequestContext extends TemplateElement {
	constructor() {
		super({
			propertyOptions: {
				counterStore: {
					requestContext: true,
				},
				vanillaContext: {
					requestContext: true,
				},
				otherContext: {
					requestContext: (context) => {
						this.callBackCalled = context;
					},
				},
			},
		});
	}
	properties() {
		return {
			callBackCalled: '',
			counterStore: {},
		};
	}
	// reactive attributes/properties

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
