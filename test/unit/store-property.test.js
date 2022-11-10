/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';
import { StoreProperty } from '../../src/util/StoreProperty';

const primitiveStore = new StoreProperty(100);
const simpleStore = new StoreProperty({ count: 0 });

class ComplexStore extends StoreProperty {
	properties() {
		return {
			anotherCount: 0,
		};
	}

	get sum() {
		return this.count + this.anotherCount;
	}
}

const complexStore = new ComplexStore({ count: 0 });

class StoreElement extends BaseElement {
	updateCount = 0;

	properties() {
		return {
			simpleStore,
		};
	}

	afterUpdate() {
		super.afterUpdate();
		this.updateCount++;
	}
}

class AnotherStoreElement extends StoreElement {}

class ComplexStoreElement extends StoreElement {
	properties() {
		return {
			store: complexStore,
		};
	}
}

class PrimitiveStoreElement extends StoreElement {
	properties() {
		return {
			primitiveStore,
		};
	}
}

const tagA = defineCE(StoreElement);
const tagB = defineCE(AnotherStoreElement);
const tagC = defineCE(ComplexStoreElement);
const tagPrimitive = defineCE(PrimitiveStoreElement);

describe('store-observer', () => {
	it('generates reactive store properties from object as constructor argument ', async () => {
		assert.equal(!!Object.getOwnPropertyDescriptor(simpleStore, 'count').set, true);
	});

	it('generates reactive store properties from stores properties map ', async () => {
		assert.equal(!!Object.getOwnPropertyDescriptor(complexStore, 'anotherCount').set, true);
	});

	it('merges constructor arguments and stores properties map to create reactive store properties ', async () => {
		assert.equal(!!Object.getOwnPropertyDescriptor(complexStore, 'anotherCount').set, true);
		assert.equal(!!Object.getOwnPropertyDescriptor(simpleStore, 'count').set, true);
	});
	it('observes the store updates when returned by property map', async () => {
		const el = await fixture(`<${tagA}></${tagA}>`);
		assert.equal(el.updateCount, 0);
		simpleStore.count = 1;
		await nextFrame();
		assert.equal(el.updateCount, 1);
	});
	it('updates multiple components that reference the same store in their property map', async () => {
		const el = await fixture(`<${tagA}></${tagA}>`);
		const elB = await fixture(`<${tagB}></${tagB}>`);
		assert.equal(el.updateCount, 0);
		assert.equal(elB.updateCount, 0);
		simpleStore.count = 1;
		await nextFrame();
		assert.equal(el.updateCount, 1);
		assert.equal(elB.updateCount, 1);
	});
	it('updates componentA when componentB updates a store that both components observe', async () => {
		const el = await fixture(`<${tagA}></${tagA}>`);
		const elB = await fixture(`<${tagB}></${tagB}>`);
		assert.equal(el.updateCount, 0);
		assert.equal(elB.updateCount, 0);
		el.simpleStore.count = 1;
		await nextFrame();
		assert.equal(el.updateCount, 1);
		assert.equal(elB.updateCount, 1);
	});

	it('allows to rename the store via property map ', async () => {
		const el = await fixture(`<${tagC}></${tagC}>`);
		el.store.count = 1;
		await nextFrame();
		assert.equal(complexStore.count, 1);
	});

	it('registers a store property from a store property map ', async () => {
		const el = await fixture(`<${tagC}></${tagC}>`);
		assert.equal(el.updateCount, 0);
		el.store.count = 1;
		el.store.anotherCount = 1;
		await nextFrame();
		assert.equal(el.store.sum, 2);
	});

	//TODO add a test to unsubscribe aka test removal
	//TODO add a test to fn callbacks

	//TODO add a test to check specificty contructor param > pre defined
	it('wraps primitive constructor values with a value field', async () => {
		assert.property(primitiveStore, 'value');
		assert.equal(primitiveStore.value, 100);
	});

	it('adds a shortcut getter to valueOf if _state contains only one value', async () => {
		assert.equal(primitiveStore, 100);
	});

	it('does not add a value field when constructor Elements are ObjectLike', async () => {
		assert.notProperty(complexStore, 'value');
	});

	it('does not adds a shortcut getter to valueOf if _state contains more than one value', async () => {
		assert.isObject(complexStore.valueOf());
	});

	it('adds a setter to a primitive value via the value setter.', async () => {
		const el = await fixture(`<${tagPrimitive}></${tagPrimitive}>`);
		await nextFrame();
		assert.equal(el.primitiveStore, 100);
		// global change
		primitiveStore.value++;
		await nextFrame();

		// updates the element
		assert.equal(el.updateCount, 1);
		assert.equal(el.primitiveStore, 101);
	});

	it('removes an observer when an observing  element is removed from DOM.  ', async () => {
		const el = await fixture(`<${tagA}></${tagA}>`);
		await nextFrame();
		assert.equal(simpleStore._observer.has(el), true);
		el.remove();
		await nextFrame();

		assert.equal(simpleStore._observer.has(el), false);
	});
});
