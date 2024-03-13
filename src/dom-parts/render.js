/**
 * Render a template string into the given DOM node
 * @param {TemplateResult | string} template
 * @param {Element} domNode
 */
const render = (template, domNode) => {
	if (typeof template === 'string') {
		// just a plain string (or literal)
		domNode.innerHTML = template;
	} else {
		template.renderInto(domNode);
	}
};

export { render };
