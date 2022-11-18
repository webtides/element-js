/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';
import { Store } from '../../src/util/Store';

const simpleStore = new Store({ count: 0 });

class ComplexStore extends Store {
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

const tagA = defineCE(StoreElement);
const tagB = defineCE(AnotherStoreElement);
const tagC = defineCE(ComplexStoreElement);

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

	it('does not add a value field when constructor Elements are ObjectLike', async () => {
		assert.notProperty(complexStore, 'value');
	});

	it('does not adds a shortcut getter to valueOf if _state contains more than one value', async () => {
		assert.isObject(complexStore.valueOf());
	});

	it('it considers Constructor arguments to be more specific than predefined properties', async () => {
		const complexStore = new ComplexStore({ anotherCount: 200 });
		assert.equal(complexStore.anotherCount, 200);
	});

	it('removes an observer when an observing  element is removed from DOM.  ', async () => {
		const el = await fixture(`<${tagA}></${tagA}>`);
		await nextFrame();
		assert.equal(simpleStore._observer.has(el), true);
		el.remove();
		await nextFrame();

		assert.equal(simpleStore._observer.has(el), false);
	});
	it('calls a callback function when provided via subscribe.', async () => {
		let testCount = 0;
		const callback = () => {
			testCount++;
		};
		simpleStore.subscribe(callback);
		// increment to trogger a change
		assert.equal(testCount, 0);
		simpleStore.count++;
		// means callback was called
		assert.equal(testCount, 1);
	});

	it('removes an observer callback function when unsubscribe is called.', async () => {
		const callback = () => {
			testCount++;
		};
		simpleStore.subscribe(callback);
		// increment to trogger a change
		assert.equal(simpleStore._observer.has(callback), true);
		simpleStore.unsubscribe(callback);
		// means callback was called
		assert.equal(simpleStore._observer.has(callback), false);
	});
});
