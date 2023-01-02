/**
 * Render a template string into the given DOM node
 * @param {TemplateResult | string} template
 * @param {Element} domNode
 */
const render = (template, domNode) => {
	// TODO: template could be a string ?!
	// TODO: make it possible that template could also be an html element ?!
	console.time('diff');

	template.renderInto(domNode);

	console.timeEnd('diff');
};

export { render };
