/**
 * Render a template string into the given DOM node
 * @param {TemplateResult | string} template
 * @param {Element} domNode
 */
const render = (template, domNode) => {
	console.time('diff');
	template.renderInto(domNode);
	console.timeEnd('diff');
};

export { render };
