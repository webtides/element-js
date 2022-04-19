const _cachedTemplateElements = {};

const convertStringToHTML = (templateString) => {
	const parser = new DOMParser();
	const document = parser.parseFromString(`<main>${templateString}</main>`, 'text/html');

	return document.querySelector('main');
};

/**
 * Diff the attributes on the target DOM node versus the template DOM node
 * @param  {Node} template The new template
 * @param  {Node} existing The existing DOM node
 */
const diffAttributes = function (template, target) {
	// Get attributes to remove
	const toRemove = Array.from(target.attributes).filter(function (targetAttribute) {
		const getAtt = Array.from(template.attributes).find(function (templateAttribute) {
			return targetAttribute.name === templateAttribute.name;
		});
		return getAtt === undefined;
	});

	// Get attributes to change
	const toChange = Array.from(template.attributes).filter(function (templateAttribute) {
		const getAtt = Array.from(target.attributes).find((targetAttribute) => {
			return templateAttribute.attributeName === targetAttribute.attributeName;
		});
		return getAtt === undefined || getAtt.value !== templateAttribute.value;
	});

	// add/update toChange attributes
	for (const attribute of toChange) {
		// TODO: handle attributes with "." aka properties...
		target.setAttribute(attribute.name, attribute.value || '');
	}

	// remove toRemove attributes
	for (const attribute of toRemove) {
		// TODO: handle attributes with "." aka properties...
		target.removeAttribute(attribute.name);
	}
};

const isTemplateElement = (element) => {
	const tagName = element.node?.tagName?.toLowerCase() ?? false;
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
 * Diff the target DOM node versus the template DOM node
 * @param {Node} template
 * @param {Node} target
 */
const diff = function (template, target) {
	const templateChildNodes = [...template.childNodes];
	const targetChildNodes = [...target.childNodes];

	// TODO: what about plainlySetInnerHTML ?!

	// If extra elements in target, remove them
	let count = targetChildNodes.length - templateChildNodes.length;
	if (count > 0) {
		for (; count > 0; count--) {
			targetChildNodes[targetChildNodes.length - count].parentNode.removeChild(
				targetChildNodes[targetChildNodes.length - count],
			);
		}
	}

	// Diff each item in the templateMap
	//templateChildNodes.forEach(function (templateNode, index) {
	for (let index = 0; index < templateChildNodes.length; index++) {
		const templateNode = templateChildNodes[index];
		const targetNode = targetChildNodes[index];

		// If target node doesn't exist, create it
		if (!targetChildNodes[index]) {
			target.appendChild(templateNode);
			continue;
		}

		// If target node is equal to the template node, don't do anything
		if (targetNode.isEqualNode(templateNode)) {
			continue;
		}

		// If node type is not the same, replace it with the template node
		if (templateNode.nodeType !== targetNode.nodeType) {
			targetNode.parentNode.replaceChild(templateNode, targetNode);
			continue;
		}

		// If attributes are different, update them
		if (templateNode.nodeType === 1) {
			diffAttributes(templateNode, targetNode);
		}

		// If content is different, update it
		if (targetNode.nodeType === 3) {
			if (targetNode.textContent !== templateNode.textContent) {
				targetNode.textContent = templateNode.textContent;
				continue;
			}
		}

		// TODO: what about plainlySetInnerHTML ?!
		// if (node.children.plainlySetInnerHTML && domMap[index]) {
		// 	domMap[index].innerHTML = node.children.innerHTML;
		// 	return;
		// }

		// If target should be empty, remove all child nodes
		if (targetNode.hasChildNodes() && !templateNode.hasChildNodes()) {
			targetNode.replaceChildren();
			continue;
		}

		// If target is empty but shouldn't be, add child nodes
		if (!targetNode.hasChildNodes() && templateNode.hasChildNodes()) {
			targetNode.replaceChildren(...templateNode.childNodes);
			continue;
		}

		// If there are existing child elements that need to be modified, diff them
		if (templateNode.hasChildNodes()) {
			if (!isTemplateElement(templateNode)) {
				diff(templateNode, targetNode);
			}
		}
	}
};

const render = (template, target) => {
	console.time('render');

	console.time('convertStringToHTML');
	const domTemplate = convertStringToHTML(template);
	console.timeEnd('convertStringToHTML');

	console.time('diffJIT');
	diff(domTemplate, target);
	console.timeEnd('diffJIT');

	console.timeEnd('render');
};

export { render };
