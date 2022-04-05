function property(options) {
	return (value, context) => {
		if (!context.kind === 'accessor') {
			console.warn(
				`cannot apply @property decorator for property ${context.name} because the "accssor" keyword is missing.`,
			);
		}

		if (context.kind === 'accessor') {
			let { get, set } = value;
			return {
				get() {
					//return get.call(this);
					return this._state[context.name];
				},

				set(value) {
					//return set.call(this, value);

					const oldValue = this._state[context.name];
					const newValueString = JSON.stringify(value);

					if (JSON.stringify(oldValue) !== newValueString) {
						this._state[context.name] = value;

						// TODO: there is more to do here... notify, watched, events etc. This should be a function in the BaseElement
						if (this._options.propertyOptions[context.name]?.reflect) {
							this.reflectProperty({ property: context.name, newValue: value });
						}

						this.requestUpdate();
					}
				},

				init(initialValue) {
					this._state = this._state || {};
					this._state[context.name] = initialValue;

					const propertyOptions = {};
					if (options.reflect) {
						propertyOptions.reflect = options.reflect;
					}
					if (options.parse) {
						propertyOptions.reflect = options.parse;
					}
					if (options.notify) {
						propertyOptions.notify = options.notify;
					}

					// this will be set after the constructor of the BaseElement
					// this could potentially overwrite some propertyOptions from the constructor...
					this._options.propertyOptions[context.name] = propertyOptions;

					if (this._options.propertyOptions[context.name]?.reflect) {
						this.reflectProperty({ property: context.name, newValue: initialValue });
					}

					return initialValue;
				},
			};
		}
	};
}

export { property };
