import { isObjectLike } from './AttributeParser';

export class StoreProperty {
	_observer = new Set();
	_singlePropertyMode = false;
	_state = {};

	constructor(value) {
		// wrap primitives with a generic "value" field to generate getter and setter
		const specificValues = isObjectLike(value) ? value : { value };
		this._state = { ...this.properties(), ...specificValues };
		this._singlePropertyMode = Object.keys(this._state).length === 1;

		Object.entries(this._state).map(([key, value]) => {
			Object.defineProperty(this, key, {
				get: () => {
					return this._state[key];
				},
				set: (newValue) => {
					this._state[key] = newValue;
					this.requestUpdate();
				},
			});
		});
	}

	properties() {
		return {};
	}

	valueOf() {
		return this._singlePropertyMode ? this._state.value : this._state;
	}

	toString() {
		return `${this._state}`;
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
		this._observer.forEach((observer) =>
			typeof observer.requestUpdate === 'function' ? observer.requestUpdate() : observer(),
		);
	}
}
