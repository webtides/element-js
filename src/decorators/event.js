class EventEmitter {
	constructor(name, bubbles, cancelable, composed) {
		this.name = name;
		this.bubbles = bubbles;
		this.cancelable = cancelable;
		this.composed = composed;
	}
}

function event(options) {
	console.log('@event', options);
	return (value, context) => {
		console.log('@event', value, context);
		if (context.kind === 'field') {
			return function (initialValue) {
				return initialValue;
			};
		}
	};
}

export { event };
