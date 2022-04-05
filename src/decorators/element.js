function element(options) {
	return (value, context) => {
		context.addInitializer(function () {
			if (options.styles) {
				// TODO: this adds the _styles to the element class. Check if this is the best way to do it...
				value._styles = options.styles;
			}
			customElements.define(options.name, this);
		});
		if (context.kind === 'class') {
			return value;
		}
	};
}

export { element };
