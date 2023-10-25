import { isObjectLike, deepEquals } from './AttributeParser.js';
import { BaseElement } from '../BaseElement';

export class Store {
	_observer = new Set();
	_singlePropertyMode = false;
	_state = {};

	constructor(value) {
		// wrap primitives with a generic "value" field to generate getter and setter
		this._singlePropertyMode = arguments.length > 0 && !isObjectLike(value);
		const specificValues = this._singlePropertyMode ? { value } : value;
		this._state = { ...(!this._singlePropertyMode && this.properties()), ...specificValues };

		Object.entries(this._state).map(([key, value]) => {
			if (value instanceof Store) {
				value.subscribe(this);
			}

			Object.defineProperty(this, key, {
				get: () => {
					return this._state[key];
				},
				set: (newValue) => {
					const oldValue = this._state[key];
					this._state[key] = newValue;
					if (value instanceof Store) {
						value.subscribe(this);
					}

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

	properties() {
		return {};
	}

	/**
	 * When a property as the key was changed in the store, the callback function defined as value
	 * will be called with `newValue` and `oldValue`
	 * eg. { property: (oldValue, newValue) => { console.log('property changed!, oldValue, newValue); } }
	 * @return {{}}
	 */
	watch() {
		return {};
	}

	valueOf() {
		return this._singlePropertyMode ? this._state.value : this._state;
	}

	toString() {
		return `${this._singlePropertyMode ? this._state.value : this._state}`;
	}

	/**
	 * @param {BaseElement|Function|Store} observer
	 */
	subscribe(observer) {
		this._observer.add(observer);
	}
	/**
	 * @param {BaseElement|Function} observer
	 */
	unsubscribe(observer) {
		this._observer.delete(observer);
	}

	requestUpdate() {
		this._observer.forEach(async (observer) => {
			if (observer instanceof BaseElement || observer instanceof Store) {
				if (observer._options.autoUpdate) {
					await observer.requestUpdate();
				}
				// check if store is watched by an observer
				if (Object.keys(observer.watch() ?? {}).length > 0) {
					// observer actually has watched properties
					Object.keys(observer.watch() ?? {}).forEach((key) => {
						if (observer._state[key] === this) {
							// observer is actually watching store changes provide new and old values
							if (observer instanceof Store) {
								// observer is a foreign store / call watcher
								observer.watch?.()[key](this, this);
							} else {
								observer.callPropertyWatcher(key, this, this);
								observer.notifyPropertyChange(key, this);
							}
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
