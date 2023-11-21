import { isObjectLike, deepEquals } from './AttributeParser.js';
import { setSerializedState } from './SerializeStateHelper.js';
import { BaseElement } from '../BaseElement.js';

export class Store {
	_uuid;
	_observer = new Set();
	_singlePropertyMode = false;
	_state = {};

	/**
	 * @param {* | object} value
	 */
	constructor(value) {
		if (value?.hasOwnProperty('uuid') && value?.hasOwnProperty('state')) {
			this._uuid = value.uuid;
			this._state = value.state;
		} else {
			this._uuid = globalThis.crypto.randomUUID();
			// wrap primitives with a generic "value" field to generate getter and setter
			this._singlePropertyMode = arguments.length > 0 && !isObjectLike(value);
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

					setSerializedState(this._uuid, this._state);

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

	static createInstanceFromState(uuid, state) {
		return new this({ uuid, state });
	}
}
