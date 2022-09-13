const _cachedTemplateElements = {};

/**
 * Parses the given template string and returns a real DOM element.
 * @param {string} template
 * @returns {HTMLElement}
 */
const convertStringToHTML = (template) => {
	const parser = new DOMParser();
	const document = parser.parseFromString(template.toString(), 'text/html');
	return document.body;
};

/**
 * Diff the attributes for a live DOM element against a template DOM element
 * @param  {Element} templateElement The new template
 * @param  {Element} domElement The existing DOM node
 */
const diffAttributes = function (templateElement, domElement) {
	// remove or update previous attributes
	for (/** @type {Attr} */ const attribute of Array.from(domElement.attributes)) {
		if (templateElement.hasAttribute(attribute.name)) {
			const oldValue = attribute.value;
			const newValue = templateElement.getAttribute(attribute.name) || '';
			if (oldValue !== newValue) {
				domElement.setAttribute(attribute.name, newValue);
			}
		} else {
			domElement.removeAttribute(attribute.name);
		}
	}

	// set newly added attributes
	for (/** @type {Attr} */ const attribute of Array.from(templateElement.attributes)) {
		if (!domElement.hasAttribute(attribute.name)) {
			domElement.setAttribute(attribute.name, attribute.value);
		}
	}
};

/**
 * Checks whether the given element or node is a TemplateElement or not
 * @param {Element|Node} element
 * @returns {boolean}
 */
const isTemplateElement = (element) => {
	const tagName = element.tagName?.toLowerCase() ?? false;
	if (!tagName || !tagName.includes('-')) {
		return false;
	}

	if (_cachedTemplateElements[tagName]) {
		return true;
	}

	const elementClass = customElements.get(tagName);
	const isTemplateElement = elementClass && elementClass._$templateElement$ === true;

	if (isTemplateElement) {
		_cachedTemplateElements[tagName] = elementClass;
	}

	return isTemplateElement;
};

/**
 * Diff a live DOM node against a template DOM node
 * @param {Node} templateNode
 * @param {Node} domNode
 */
const diffNodes = function (templateNode, domNode) {
	const templateChildNodes = [...templateNode.childNodes];
	const domChildNodes = [...domNode.childNodes];

	// Diff each node in the child node lists
	const length = Math.max(templateChildNodes.length, domChildNodes.length);
	for (let index = 0; index < length; index++) {
		const templateChildNode = templateChildNodes[index];
		const domChildNode = domChildNodes[index];

		// If the DOM node doesn't exist, append/copy the template node
		if (!domChildNode) {
			domNode.appendChild(templateChildNode);
			continue;
		}

		// If the template node doesn't exist, remove the node in the DOM
		if (!templateChildNode) {
			domChildNode.parentNode.removeChild(domChildNode);
			continue;
		}

		// If DOM node is equal to the template node, don't do anything
		if (domChildNode.isEqualNode(templateChildNode)) {
			continue;
		}

		// If node types are not the same, replace the DOM node with the template node
		if (templateChildNode.nodeType !== domChildNode.nodeType) {
			domChildNode.parentNode.replaceChild(templateChildNode, domChildNode);
			continue;
		}

		// If the element tag names are not the same, replace the DOM node with the template node
		if (templateChildNode.nodeType === 1 && templateChildNode.tagName !== domChildNode.tagName) {
			domChildNode.parentNode.replaceChild(templateChildNode, domChildNode);
			continue;
		}

		// If the node is an SVG element, don't even think about diffing it, just replace it
		if (templateChildNode.nodeType === 1 && templateChildNode.tagName === 'SVG') {
			domChildNode.parentNode.replaceChild(templateChildNode, domChildNode);
			continue;
		}

		// If the node is an Element node, diff the attributes
		if (templateChildNode.nodeType === 1) {
			diffAttributes(templateChildNode, domChildNode);
		}

		// If the node is a Text node or a Comment node, update it
		if (domChildNode.nodeType === 3 || domChildNode.nodeType === 8) {
			domChildNode.textContent = templateChildNode.textContent;
			continue;
		}

		// If the DOM node should be empty, remove all child nodes
		if (domChildNode.hasChildNodes() && !templateChildNode.hasChildNodes()) {
			domChildNode.replaceChildren();
			continue;
		}

		// If the DOM node is empty, but should have children, add child nodes from the template node
		if (!domChildNode.hasChildNodes() && templateChildNode.hasChildNodes()) {
			domChildNode.replaceChildren(...templateChildNode.childNodes);
			continue;
		}

		// If there are child nodes, diff them recursively
		if (templateChildNode.hasChildNodes()) {
			if (!isTemplateElement(templateChildNode)) {
				diffNodes(templateChildNode, domChildNode);
			}
		}
	}
};

/**
 * Render a template string into the given DOM node
 * @param {string} template
 * @param {Node} domNode
 */
const render = (template, domNode) => {
	const templateNode = convertStringToHTML(template);
	diffNodes(templateNode, domNode);
};

export { render };
