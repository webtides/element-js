/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';
import { Store } from '../../src/util/Store';

const primitiveStore = new Store(100);

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

const complexStoreWithoutParam = new ComplexStore();

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

class PrimitiveStoreElement extends StoreElement {
	properties() {
		return {
			primitiveStore,
		};
	}
}

const tagPrimitive = defineCE(PrimitiveStoreElement);

describe('store-observer', () => {
	it('wraps primitive constructor values with a value field', async () => {
		assert.property(primitiveStore, 'value');
		assert.equal(primitiveStore.value, 100);
	});

	it('adds a shortcut getter to valueOf if _state contains only one value', async () => {
		assert.equal(primitiveStore, 100);
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

	it('it switches to primitive mode when a primitive value is passed as argument even if the store has a properties() getter', async () => {
		const complexStore = new ComplexStore(100);
		assert.equal(complexStore, 100);
		assert.isUndefined(complexStore.anotherCount);
	});

	it('it allows to initialize Primitive Stores with 0', async () => {
		const primitiveStore = new Store(0);
		assert.equal(primitiveStore, 0);
		primitiveStore.value = 100;
		assert.equal(primitiveStore, 100);
	});

	it('does not enter singlePropertyMode if no argument is passed to constructor', async () => {
		assert.equal(complexStoreWithoutParam.anotherCount, 0);
	});
});
