/**
 * Render a template string into the given DOM node
 * @param {TemplateResult | string} template
 * @param {Element} domNode
 */
const render = (template, domNode) => {
	template.renderInto(domNode);
};

export { render };
