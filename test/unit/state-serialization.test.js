/* eslint-disable no-unused-expressions */
import { fixture, fixtureSync, defineCE, assert, expect, nextFrame } from '@open-wc/testing';
import { TemplateElement, html } from '../../src/TemplateElement.js';
import { BaseElement } from '../../src/BaseElement.js';
import { Store } from '../../src/util/Store.js';

const sharedStore = new Store({ count: 0 }, { key: 'shared-store ' });

const tag = defineCE(
	class extends BaseElement {
		properties() {
			return {
				count: 0,
				store: new Store({ count: 0 }),
				sharedStore: sharedStore,
			};
		}
	},
);

const otherFieldsTag = defineCE(
	class extends BaseElement {
		nonReactiveCount = -1;

		properties() {
			return {
				count: 0,
			};
		}

		serializeState() {
			return {
				nonReactiveCount: this.nonReactiveCount,
			};
		}
	},
);

function createSerializedState(state) {
	const globalElementJsState = Array.from(globalThis.document.scripts).find(
		(script) => script.type === 'element-js/json',
	);
	globalElementJsState.textContent = JSON.stringify(state);
}

describe('state-serialization', () => {
	beforeEach(() => {
		globalThis.elementJsConfig = {};

		const globalElementJsState = Array.from(globalThis.document.scripts).find(
			(script) => script.type === 'element-js/json',
		);

		if (!globalElementJsState) {
			const script = document.createElement('script');
			script.setAttribute('type', 'element-js/json');
			script.textContent = '{}';
			document.body.appendChild(script);
		}
	});

	it('does not serialize state by default', async () => {
		const el = fixtureSync(`<${tag}></${tag}>`);

		const globalElementJsState = Array.from(globalThis.document.scripts).find(
			(script) => script.type === 'element-js/json',
		);

		assert.equal(el.getAttribute('eljs:key'), null);
		assert.equal(globalElementJsState.textContent, '{}');
	});

	it('creates a global JSON script if enabled', async () => {
		globalThis.elementJsConfig.serializeState = true;

		const el = fixtureSync(`<${tag}></${tag}>`);

		const globalElementJsState = Array.from(globalThis.document.scripts).find(
			(script) => script.type === 'element-js/json',
		);

		assert.notEqual(el.getAttribute('eljs:key'), null);
		assert.notEqual(globalElementJsState, undefined);
	});

	it('can restore element state from serialized JSON', async () => {
		globalThis.elementJsConfig.serializeState = true;
		createSerializedState({ qwertzuiop: { count: 13 } });

		const el = fixtureSync(`<${tag} eljs:key="qwertzuiop" count="7"></${tag}>`);

		assert.notEqual(el.count, 0);
		assert.notEqual(el.count, 7);
		assert.equal(el.count, 13);
	});

	it('can serialize a custom state object by overriding serializeState and restoreState', async () => {
		globalThis.elementJsConfig.serializeState = true;
		createSerializedState({ qwertzuiop: { nonReactiveCount: 3 } });

		const el = fixtureSync(`<${otherFieldsTag} eljs:key="qwertzuiop"></${otherFieldsTag}>`);

		assert.notEqual(el.nonReactiveCount, -1);
		assert.equal(el.nonReactiveCount, 3);
	});

	it('can serialize nested store properties', async () => {
		globalThis.elementJsConfig.serializeState = true;
		createSerializedState({ qwertzuiop: { store: 'Store/asdfghjkl' }, asdfghjkl: { count: 13 } });

		const el = fixtureSync(`<${tag} eljs:key="qwertzuiop"></${tag}>`);

		assert.notEqual(el.store.count, 0);
		assert.equal(el.store.count, 13);
	});

	it('can serialize shared store instance properties', async () => {
		globalThis.elementJsConfig.serializeState = true;
		createSerializedState({ qwertzuiop: { sharedStore: 'Store/shared-store' }, 'shared-store': { count: 13 } });

		const el = fixtureSync(`<${tag} eljs:key="qwertzuiop"></${tag}>`);

		assert.notEqual(el.sharedStore.count, 0);
		assert.equal(el.sharedStore.count, 13);
	});

	it('can serialize shared store instance properties over multiple elements', async () => {
		globalThis.elementJsConfig.serializeState = true;
		createSerializedState({
			qwertzuiop: { sharedStore: 'Store/shared-store' },
			'shared-store': { count: 13 },
			asdfghjkl: { sharedStore: 'Store/shared-store' },
		});

		const el = fixtureSync(`<${tag} eljs:key="qwertzuiop"></${tag}>`);
		const el2 = fixtureSync(`<${tag} eljs:key="asdfghjkl"></${tag}>`);

		assert.equal(el.sharedStore.count, 13);
		assert.equal(el.sharedStore, el2.sharedStore);
	});

	afterEach(() => {
		globalThis.elementJsConfig = undefined;
		const globalElementJsState = Array.from(globalThis.document.scripts).find(
			(script) => script.type === 'element-js/json',
		);
		if (globalElementJsState) {
			globalElementJsState.textContent = '{}';
		}
	});
});
