/* eslint-disable no-unused-expressions */
import { runTests } from '@web/test-runner-mocha';
import { assert, expect, nextFrame, chai } from '@open-wc/testing';
import { html, defineElement, BaseElement, TemplateElement } from '../../index';

import { Store } from '../../src/util/Store';

export const primitiveStore = new Store(100);

export class LateProvider extends BaseElement {
	static LATE_CONTEXT = 'lateContext';

	provideProperties() {
		return {
			lateContext: LateProvider.LATE_CONTEXT,
		};
	}
}

export class AncestorContextElement extends BaseElement {
	static CONTEXT = 'ancestorContext';
	static MULTI = 'ancestorMultiContext';

	properties() {
		return {
			ancestorContext: AncestorContextElement.CONTEXT,
			multiContext: AncestorContextElement.MULTI,
			storeContext: primitiveStore,
		};
	}

	provideProperties() {
		return {
			ancestorContext: this.ancestorContext,
			multiContext: this.multiContext,
			storeContext: this.storeContext,
		};
	}
}

export class ParentContextElement extends BaseElement {
	static SIMPLE_CONTEXT = 'simpleParentContext';
	static MULTI = 'parentMultiContext';
	static INLINE = 'parentInlineContext';
	static STATIC = 'parentStaticContext';

	properties() {
		return {
			simpleContext: ParentContextElement.SIMPLE_CONTEXT,
			multiContext: ParentContextElement.MULTI,
		};
	}

	provideProperties() {
		return {
			simpleContext: this.simpleContext,
			multiContext: this.multiContext,
			inlineCallback: ParentContextElement.INLINE,
			staticContext: ParentContextElement.STATIC,
			booleanContext: false,
		};
	}
}

export class RequestContextElement extends BaseElement {
	properties() {
		return {
			callBackCalled: null,
			simpleContext: '',
			multiContext: '',
			inlineCallbackValue: '',
			watcherReflectedValue: 0,
		};
	}

	// reactive attributes/properties
	injectProperties() {
		return {
			counterStore: {},
			vanillaContext: '',
			missingVanillaContext: null,
			simpleContext: '',
			ancestorContext: null,
			multiContext: null,
			storeContext: {},
			noContext: 'noContext',
			staticContext: 'noContext',
			booleanContext: true,
			lateContext: null,
			inlineCallback: (value) => {
				this.inlineCallbackValue = value;
			},
		};
	}

	watch() {
		return {
			storeContext: (newValues) => {
				this.watcherReflectedValue = newValues.value;
			},
		};
	}

	connected() {
		console.log('requester connected', this.id);
		super.connected();
		this.requestContext('callbackContext', (context) => {
			this.callBackCalled = context === globalThis.callbackContext;
		});
	}
}

export class ShadowProvider extends TemplateElement {
	static SHADOW_CONTEXT = 'shadowContext';

	constructor() {
		super({ shadowRender: true });
	}

	provideProperties() {
		return {
			shadowContext: ShadowProvider.SHADOW_CONTEXT,
		};
	}
	injectProperties() {
		return {
			vanillaContext: '',
			simpleContext: '',
		};
	}
	connected() {
		console.log('shadow connected');
		super.connected();
	}

	onRequestContext(event) {
		super.onRequestContext(event);
		// console.log(event.composedPath()[0], event.type, event.detail);
	}

	template() {
		return html`<div>
			<request-context-element id="shadow"></request-context-element>
			<slot></slot>
		</div>`;
	}
}
