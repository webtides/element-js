export class StoreProperty {
	_observer = new Set();
	_state = {};

	constructor(value) {
		this._state = { ...value, ...this.properties() };

		Object.entries(this._state).map(([key, value]) => {
			Object.defineProperty(this, key, {
				get: () => {
					return this._state[key];
				},
				set: (newValue) => {
					this._state[key] = newValue;
					this.notifyObserver();
				},
			});
		});
	}

	properties() {
		return {};
	}

	valueOf() {
		return this._state;
	}

	toString() {
		return `${this._state}`;
	}

	registerObserver(observer) {
		this._observer.add(observer);
	}

	notifyObserver() {
		this._observer.forEach((observer) => observer.requestUpdate());
	}
}
