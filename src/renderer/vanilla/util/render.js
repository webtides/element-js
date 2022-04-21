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
	// TODO: maybe we can compare them and return early if they are the same?!
	// unfortunately there is (currently) no native way to compare the NamedNodeMap from element.attributes
	// we would have to loop over them and map them to be able to stringify them -> too slow at the moment
	// and also it would depend on attributes and there values being in the same order (which is actually not necessary)

	for (/** @type {Attr} */ const attribute of Array.from(domElement.attributes)) {
		if (templateElement.hasAttribute(attribute.name)) {
			// TODO: handle attributes with "." aka properties...
			const oldValue = attribute.value;
			const newValue = templateElement.getAttribute(attribute.name) || '';
			if (oldValue !== newValue) {
				domElement.setAttribute(attribute.name, newValue);
			}
		} else {
			domElement.removeAttribute(attribute.name);
		}
	}

	// TODO: this is not enough... we are currently missing newly added attributes :(
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

	// If extra nodes in the DOM, add dummy nodes to the template DOM so that the length will be the same
	let count = domChildNodes.length - templateChildNodes.length;
	if (count > 0) {
		for (let index = count; index > 0; index--) {
			templateChildNodes.push(document.createElement('delete-me'));
		}
	}

	// Diff each node in the template child nodes list
	for (let index = 0; index < templateChildNodes.length; index++) {
		const templateChildNode = templateChildNodes[index];
		const domChildNode = domChildNodes[index];

		// If the DOM node doesn't exist, append/copy the template node
		if (!domChildNodes[index]) {
			domNode.appendChild(templateChildNode);
			continue;
		}

		// If the template node is a dummy node, remove the node in the DOM
		if (templateChildNode.tagName === 'DELETE-ME') {
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

		// If the node is an Element node, diff the attributes
		if (templateChildNode.nodeType === 1) {
			diffAttributes(templateChildNode, domChildNode);
		}

		// If the node is a Text node and the content is different, update it
		if (domChildNode.nodeType === 3) {
			if (domChildNode.textContent !== templateChildNode.textContent) {
				domChildNode.textContent = templateChildNode.textContent;
				continue;
			}
		}

		// TODO: what about plainlySetInnerHTML ?!
		// if (node.children.plainlySetInnerHTML && domMap[index]) {
		// 	domMap[index].innerHTML = node.children.innerHTML;
		// 	return;
		// }

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
				diff(templateChildNode, domChildNode);
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
