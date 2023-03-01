import { isObjectLike, deepEquals } from './AttributeParser.js';
import { informWatchedPropertiesAndDispatchChangeEvent } from './PropertyHelper';

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
			Object.defineProperty(this, key, {
				get: () => {
					return this._state[key];
				},
				set: (newValue) => {
					const oldValue = this._state[key];
					this._state[key] = newValue;

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
	 * @param {BaseElement|Function} observer
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
			typeof observer.requestUpdate === 'function' ? await observer.requestUpdate() : observer();
			// check if store is watched by an observer
			if (typeof observer.watch === 'function' && Object.keys(observer.watch() ?? {}).length > 0) {
				// observer actually has watched properties
				const properties = observer.properties();
				Object.keys(observer.watch() ?? {}).forEach((key) => {
					if (properties[key] === this) {
						// observer is actually watching store changes
						informWatchedPropertiesAndDispatchChangeEvent(observer, key, this, this);
					}
				});
			}
		});
	}
}
