import { deepEquals, isObjectLike } from './AttributeParser.js';
import {
	hasSerializedState,
	serializeState,
	deserializeState,
	serializableObjectsCache,
} from './SerializeStateHelper.js';
import { BaseElement } from '../BaseElement.js';

/**
 * Options object for the Store
 * @typedef {Object} StoreOptions
 * @property {string} [key] - A unique key so that the store instance can be serialized and deserialized correctly across multiple shared parents/hosts.
 */

/**
 * @implements {Serializable}
 */
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
		if (options?.key && serializableObjectsCache.has(options?.key)) {
			return serializableObjectsCache.get(options?.key);
		}

		this._singlePropertyMode = arguments.length > 0 && !isObjectLike(value);

		if (options?.key) {
			this._serializationKey = options?.key;
		} else {
			this._serializationKey = globalThis.crypto.randomUUID();
		}

		if (options?.serializedState) {
			deserializeState(this, options.serializedState);
		} else if (hasSerializedState(this._serializationKey)) {
			deserializeState(this);
		}

		// wrap primitives with a generic "value" field to generate getter and setter
		const specificValues = this._singlePropertyMode ? { value } : value;
		const properties = { ...(!this._singlePropertyMode && this.properties()), ...specificValues };

		const serializationKeys = Object.keys(this.toJSON());
		Object.entries(properties).map(([key, value]) => {
			this._state[key] =
				hasSerializedState(this._serializationKey) && serializationKeys.includes(key) ? this[key] : value;
			Object.defineProperty(this, key, {
				get: () => {
					return this._state[key];
				},
				set: (newValue) => {
					const oldValue = this._state[key];
					this._state[key] = newValue;

					serializeState(this);

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

		serializableObjectsCache.set(this._serializationKey, this);
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

	/**
	 * This method will be used to serialize this stores state.
	 * By default, it will generate an object with all properties from this.properties().
	 * You can override this and return a different object with more/less/different properties.
	 * @return {{[string: any]: *}}
	 */
	toJSON() {
		const keys = Object.keys(this.properties());
		return Object.fromEntries(keys.map((key) => [key, this[key]]));
	}

	/**
	 * This method will be used to restore properties on the store from a previously serialized state.
	 * You can override this and handle the deserialization differently if the default is not enough.
	 * @param {{[string: any]: *}} serializedState
	 */
	fromJSON(serializedState) {
		Object.assign(this, serializedState);
	}
}
