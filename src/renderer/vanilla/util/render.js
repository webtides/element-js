const NODE_TYPE_COMMENT = 8;
const NODE_TYPE_TEXT = 3;

const _cachedTemplateElements = {};

const convertStringToHTML = (templateString) => {
	const parser = new DOMParser();
	const document = parser.parseFromString(`<main>${templateString}</main>`, 'text/html');

	return document.querySelector('main');
};

/**
 * Create an array of the attributes on an element
 * @param  {NamedNodeMap} attributes The attributes on an element
 * @return {Array}                   The attributes on an element as an array of key/value pairs
 */
const getAttributes = function (attributes) {
	return Array.prototype.map.call(attributes, function (attribute) {
		return {
			attributeName: attribute.name,
			value: attribute.value,
		};
	});
};

/**
 * Create a DOM Tree Map for an element
 *
 * @param  {HTMLElement}    element The element to map
 * @param  {Boolean} isSVG   If true, node is within an SVG
 * @return {{ domMap: Array }} A DOM tree map
 */
const createDOMMap = function (element, isChild = false, isSVG = false, type = 'template') {
	const children = [...element.childNodes];

	const domMap = children
		.map((node) => {
			const details = {
				content: node.childNodes && node.childNodes.length > 0 ? null : node.textContent,
				attributes: node.nodeType !== 1 ? [] : getAttributes(node.attributes),
				type:
					node.nodeType === NODE_TYPE_TEXT
						? 'text'
						: node.nodeType === NODE_TYPE_COMMENT
						? 'comment'
						: node.tagName.toLowerCase(),
				node: node,
			};

			details.isSVG = isSVG || details.type === 'svg';

			if (details.isSVG) {
				details.innerHTML = node.innerHTML;
			}

			const ignoreChildren = details.isSVG || (isChild && isTemplateElement({ node }));
			details.children = ignoreChildren ? { domMap: [] } : createDOMMap(node, true, details.isSVG);

			return details;
		})
		.filter((element) => !!element);

	return {
		domMap,
	};
};

const removeAttributes = function (element, attributes) {
	attributes.forEach(function (attribute) {
		element.removeAttribute(attribute.attributeName);
	});
};

/**
 * Add attributes to an element
 * @param {HTMLElement}  element The element
 * @param {[{ attributeName: string, value: string}]} attributes The attributes to add
 */
const addAttributes = function (element, attributes) {
	attributes.forEach(function (attribute) {
		if (attribute.attributeName.startsWith('.')) {
			// Directly set the attribute on the element instance as property
			// instead of setting the attribute.
			element[attribute.attributeName.substring(1)] = attribute.value ?? '';
			return;
		}

		element.setAttribute(attribute.attributeName, attribute.value ?? '');
	});
};

/**
 * Diff the attributes on an existing element versus the template
 * @param  {Object} template The new template
 * @param  {Object} existing The existing DOM node
 */
const diffAttributes = function (template, existing) {
	// Get attributes to remove
	const remove = existing.attributes.filter(function (attribute) {
		const getAtt = template.attributes.find(function (newAtt) {
			return attribute.attributeName === newAtt.attributeName;
		});
		return getAtt === undefined;
	});

	// Get attributes to change
	const change = template.attributes.filter(function (attribute) {
		const getAtt = existing.attributes.find((existingAtt) => {
			return attribute.attributeName === existingAtt.attributeName;
		});
		return getAtt === undefined || getAtt.value !== attribute.value;
	});

	// Add/remove any required attributes
	addAttributes(existing.node, change);
	removeAttributes(existing.node, remove);
};

/**
 * Make an HTML element
 * @param  {Object} element The element details
 * @param  {Object} templateResult
 * @return {HTMLElement|false}        The HTML element
 */
const makeElement = function (element, templateResult) {
	// Create the element
	let node;
	if (element.type === 'text') {
		node = document.createTextNode(element.content);
	} else if (element.type === 'comment') {
		node = document.createComment(element.content);
	} else if (element.isSVG) {
		node = document.createElementNS('http://www.w3.org/2000/svg', element.type);
	} else {
		node = document.createElement(element.type);
	}

	// Add attributes
	addAttributes(node, element.attributes);

	// If the element has child nodes, create them
	// Otherwise, add textContent

	if (element.isSVG) {
		node.innerHTML = element.innerHTML;
	} else if (element.children.domMap.length > 0) {
		diff(element.children, { domMap: [] }, node);
	} else if (element.type !== 'text') {
		node.textContent = element.content;
	}

	return node;
};

const isTemplateElement = (element) => {
	const tagName = element.node?.tagName?.toLowerCase() ?? false;
	if (!tagName || !tagName.includes('-')) {
		return false;
	}

	if (_cachedTemplateElements[tagName]) {
		return true;
	}

	const elementClass = window.customElements.get(tagName);

	// TODO: that is not working right now. Allow passing a condition the "render" method.
	const isTemplateElement = elementClass && elementClass._$templateElement$ === true;

	if (isTemplateElement) {
		_cachedTemplateElements[tagName] = elementClass;
	}

	return isTemplateElement;
};

/**
 * Diff the existing DOM node versus the template
 * @param  {{ domMap: Array, innerHTML?: string }} templateResult A DOM tree map of the template content
 * @param  {{ domMap: array }} domResult      A DOM tree map of the existing DOM node
 * @param  {HTMLElement}  element        The element to render content into
 */
const diff = function (templateResult, domResult, element) {
	const templateMap = templateResult.domMap;

	const domMap = domResult.domMap;

	// If extra elements in domMap, remove them
	let count = domMap.length - templateMap.length;
	if (count > 0) {
		for (; count > 0; count--) {
			domMap[domMap.length - count].node.parentNode.removeChild(domMap[domMap.length - count].node);
		}
	}

	// Diff each item in the templateMap
	templateMap.forEach(function (node, index) {
		// If element doesn't exist, create it
		if (!domMap[index]) {
			const newElement = makeElement(node, node.children);
			element.appendChild(newElement);
			return;
		}

		// If element is not the same type, replace it with new element
		if (templateMap[index].type !== domMap[index].type) {
			domMap[index].node.parentNode.replaceChild(
				makeElement(templateMap[index], node.children),
				domMap[index].node,
			);
			return;
		}

		// If attributes are different, update them
		diffAttributes(templateMap[index], domMap[index]);

		// Both types are svg and the content is different, we can replace the svg content.
		if (templateMap[index].type === 'svg' && templateMap[index].innerHTML !== domMap[index].innerHTML) {
			domMap[index].node.innerHTML = templateMap[index].innerHTML;
			return;
		}

		// If content is different, update it
		if (templateMap[index].content !== domMap[index].content) {
			if (!isTemplateElement(domMap[index])) {
				// ignore custom elements.
				domMap[index].node.textContent = templateMap[index].content;
			}
		}

		// If target element should be empty, wipe it
		if (domMap[index].children.domMap.length > 0 && node.children.domMap.length < 1) {
			if (!isTemplateElement(domMap[index])) {
				// ignore custom elements.
				domMap[index].node.innerHTML = '';
			}
			return;
		}

		// If element is empty and shouldn't be, build it up
		// This uses a document fragment to minimize reflows
		if (domMap[index].children.domMap.length === 0 && node.children.domMap.length > 0) {
			if (isTemplateElement(domMap[index])) {
				return;
			}

			const fragment = document.createDocumentFragment();
			diff(node.children, domMap[index].children, domMap[index].node);
			element.appendChild(fragment);
			return;
		}

		// If there are existing child elements that need to be modified, diff them
		if (node.children.domMap.length > 0) {
			if (!isTemplateElement(node)) {
				diff(node.children, domMap[index].children, domMap[index].node);
			}
		}
	});
};

const render = (template, target) => {
	const templateDOMMap = createDOMMap(convertStringToHTML(template), false, false, 'template');
	const domMap = createDOMMap(target, false, false, 'dom');

	diff(templateDOMMap, domMap, target);
};

export { render };
