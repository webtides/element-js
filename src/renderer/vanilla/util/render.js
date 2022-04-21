const _cachedTemplateElements = {};

/**
 * Parses the given template string and returns a real DOM element.
 * @param {string} template
 * @returns {HTMLElement}
 */
const convertStringToHTML = (template) => {
	const parser = new DOMParser();
	const document = parser.parseFromString(`<main>${template}</main>`, 'text/html');
	return document.querySelector('main');
};

/**
 * Diff the attributes for a live DOM element against a template DOM element
 * @param  {Element} templateElement The new template
 * @param  {Element} domElement The existing DOM node
 */
const diffAttributes = function (templateElement, domElement) {
	const templateAttributes = {};
	for (const attribute of Array.from(templateElement.attributes)) {
		templateAttributes[attribute.name] = attribute.value;
	}

	const targetAttributes = {};
	for (const attribute of Array.from(domElement.attributes)) {
		targetAttributes[attribute.name] = attribute.value;
	}

	// TODO: maybe we can compare them and return early if the are the same?!

	// remove attributes
	for (const attributeName of Object.keys(targetAttributes)) {
		if (!templateAttributes[attributeName]) {
			domElement.removeAttribute(attributeName);
		}
	}

	// add/update attributes
	for (const attributeName of Object.keys(templateAttributes)) {
		// TODO: handle attributes with "." aka properties...
		domElement.setAttribute(attributeName, templateAttributes[attributeName] || '');
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
const diff = function (templateNode, domNode) {
	const domChildNodes = [...domNode.childNodes];
	const templateChildNodes = [...templateNode.childNodes];

	// TODO: what about plainlySetInnerHTML ?!
	// TODO: what about SVGs ?! do they need special handling?!

	// If extra elements in target, add dummy elements to template so that the length will match
	let count = domChildNodes.length - templateChildNodes.length;
	if (count > 0) {
		for (let index = count; index > 0; index--) {
			templateChildNodes.push(document.createElement('delete-me'));
		}
	}

	// Diff each node in the template child nodes array
	for (let index = 0; index < templateChildNodes.length; index++) {
		const templateNode = templateChildNodes[index];
		const domNode = domChildNodes[index];

		// If template node is dummy node, remove node in target
		if (templateNode.tagName === 'DELETE-ME') {
			domNode.parentNode.removeChild(domNode);
			continue;
		}

		// If target node doesn't exist, create it
		if (!domChildNodes[index]) {
			domNode.appendChild(templateNode);
			continue;
		}

		// If target node is equal to the template node, don't do anything
		if (domNode.isEqualNode(templateNode)) {
			continue;
		}

		// If node type is not the same, replace it with the template node
		if (templateNode.nodeType !== domNode.nodeType) {
			domNode.parentNode.replaceChild(templateNode, domNode);
			continue;
		}

		// If attributes are different, update them
		if (templateNode.nodeType === 1) {
			diffAttributes(templateNode, domNode);
		}

		// If content is different, update it
		if (domNode.nodeType === 3) {
			if (domNode.textContent !== templateNode.textContent) {
				domNode.textContent = templateNode.textContent;
				continue;
			}
		}

		// TODO: what about plainlySetInnerHTML ?!
		// if (node.children.plainlySetInnerHTML && domMap[index]) {
		// 	domMap[index].innerHTML = node.children.innerHTML;
		// 	return;
		// }

		// If target should be empty, remove all child nodes
		if (domNode.hasChildNodes() && !templateNode.hasChildNodes()) {
			domNode.replaceChildren();
			continue;
		}

		// If target is empty but shouldn't be, add child nodes
		if (!domNode.hasChildNodes() && templateNode.hasChildNodes()) {
			domNode.replaceChildren(...templateNode.childNodes);
			continue;
		}

		// If there are existing child elements that need to be modified, diff them
		if (templateNode.hasChildNodes()) {
			if (!isTemplateElement(templateNode)) {
				diff(templateNode, domNode);
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
	console.time('render');

	console.time('convertStringToHTML');
	const templateNode = convertStringToHTML(template);
	console.timeEnd('convertStringToHTML');

	console.time('diff');
	diff(templateNode, domNode);
	console.timeEnd('diff');

	console.timeEnd('render');
};

export { render };
