function query(options) {
	return (value, context) => {
		if (context.kind === 'field') {
			return function (initialValue) {
				this.addElementQuery({
					name: context.name,
					selector: typeof options === 'string' ? options : options.selector,
					root: options.root ? options.root : this.getRoot(),
					once: options.once ? options.once : true,
				});

				return undefined;
			};
		}
	};
}

function queryAll(options) {
	return (value, context) => {
		if (context.kind === 'field') {
			return function (initialValue) {
				this.addElementQuery({
					name: context.name,
					selector: typeof options === 'string' ? options : options.selector,
					all: true,
					root: options.root ? options.root : this.getRoot(),
					once: options.once ? options.once : true,
				});

				return undefined;
			};
		}
	};
}

export { query, queryAll };
