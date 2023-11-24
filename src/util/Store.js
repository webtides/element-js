import { deepEquals, isObjectLike } from './AttributeParser.js';
import { getSerializedState, setSerializedState, hasSerializedState } from './SerializeStateHelper.js';
import { BaseElement } from '../BaseElement.js';

/**
 * Options object for the Store
 * @typedef {Object} StoreOptions
 * @property {string} [key] - A unique key so that the store instance can be serialized and deserialized correctly across multiple shared parents/hosts.
 */

/** @type {Map<string, Store>} */
const storesCache = new Map();

export class Store {
	_serializationKey;
	_observer = new Set();
	_singlePropertyMode = false;
	_state = {};

	/**
	 * @param {* | object} [value]
	 * @param {StoreOptions} [options]
	 */
	constructor(value, options) {
		if (options?.key && storesCache.has(options?.key)) {
			return storesCache.get(options?.key);
		}

		this._singlePropertyMode = arguments.length > 0 && !isObjectLike(value);

		if (options?.key) {
			this._serializationKey = options?.key;
		} else {
			this._serializationKey = globalThis.crypto.randomUUID();
		}

		if (options?.serializedState) {
			this._state = options.serializedState;
		} else if (hasSerializedState(this._serializationKey)) {
			this._state = getSerializedState(this._serializationKey);
		} else {
			// wrap primitives with a generic "value" field to generate getter and setter
			const specificValues = this._singlePropertyMode ? { value } : value;
			this._state = { ...(!this._singlePropertyMode && this.properties()), ...specificValues };
		}

		Object.entries(this._state).map(([key, value]) => {
			Object.defineProperty(this, key, {
				get: () => {
					return this._state[key];
				},
				set: (newValue) => {
					const oldValue = this._state[key];
					this._state[key] = newValue;

					setSerializedState(this._serializationKey, this._state);

					if (!deepEquals(newValue, oldValue)) {
						const watch = this.watch();
						if (watch.hasOwnProperty(key) && typeof watch[key] === 'function') {
							watch[key](newValue, oldValue);
						}
						this.requestUpdate();
					}
				},
			});
		});

		storesCache.set(this._serializationKey, this);
	}

	/**
	 * Properties to be defined and assigned on the store. Can be overridden in extended classes.
	 * Properties defined here will also trigger an update cycle when changed.
	 * @return {{}}
	 */
	properties() {
		return {};
	}

	/**
	 * When a property as the key was changed in the store, the callback function defined as value
	 * will be called with `newValue` and `oldValue`
	 * @return {{}}
	 */
	watch() {
		return {};
	}

	/**
	 * Overrides `valueOf` to automatically return .value
	 * @returns {* | {}}
	 */
	valueOf() {
		return this._singlePropertyMode ? this._state.value : this._state;
	}

	/**
	 * Overrides `toString` to automatically return .value
	 * @returns {string}
	 */
	toString() {
		return `${this._singlePropertyMode ? this._state.value : this._state}`;
	}

	/**
	 * Add an observer
	 * @param {BaseElement | Function} observer
	 */
	subscribe(observer) {
		this._observer.add(observer);
	}

	/**
	 * Remove an observer
	 * @param {BaseElement | Function} observer
	 */
	unsubscribe(observer) {
		this._observer.delete(observer);
	}

	/**
	 * Request and batch an asynchronous update cycle
	 */
	requestUpdate() {
		this._observer.forEach(async (observer) => {
			if (observer instanceof BaseElement) {
				await observer.requestUpdate();
				// check if store is watched by an observer
				if (Object.keys(observer.watch() ?? {}).length > 0) {
					// observer actually has watched properties
					const properties = observer.properties();
					Object.keys(observer.watch() ?? {}).forEach((key) => {
						if (observer._state[key] === this) {
							// observer is actually watching store changes provide new and old values
							observer.callPropertyWatcher(key, this, this);
							observer.notifyPropertyChange(key, this);
						}
					});
				}
			} else if (typeof observer === 'function') {
				observer();
			} else {
				console.error('Store: observer type is not supported.', observer);
			}
		});
	}
}
