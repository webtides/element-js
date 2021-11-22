const NODE_TYPE_COMMENT = 8;
const NODE_TYPE_TEXT = 3;

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
 * @return {{ domMap: Array, plainlySetInnerHTML?: boolean, innerHTML?: string }} A DOM tree map
 */
const createDOMMap = function (element, isChild = false, isSVG = false, type = 'template') {
	const children = [...element.childNodes];

	// If the list contains a comment which says "$$plainly-set-inner-html" it means
	// that the all children of the element will be set as unsafe `innerHTML´
	// which means that there won't be any diffing or fancy things
	// but we will just mark it as a pure component and leave it be.
	for (const child of children) {
		if (child?.nodeType === NODE_TYPE_COMMENT && child.textContent === '$$plainly-set-inner-html') {
			return {
				domMap: [],
				plainlySetInnerHTML: true,
				innerHTML: element.innerHTML,
			};
		}
	}

	const domMap = children.map((node, index) => {
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
		details.children =
			isChild && isCustomElement({ node }) ? { domMap: [] } : createDOMMap(node, true, details.isSVG);
		return details;
	});

	return {
		domMap,
	};
};

const getStyleMap = function (styles) {
	return styles.split(';').reduce(function (arr, style) {
		if (style.trim().indexOf(':') > 0) {
			const styleArr = style.split(':');
			arr.push({
				name: styleArr[0] ? styleArr[0].trim() : '',
				value: styleArr[1] ? styleArr[1].trim() : '',
			});
		}
		return arr;
	}, []);
};

const removeStyles = function (elem, styles) {
	styles.forEach(function (style) {
		elem.style[style] = '';
	});
};

const changeStyles = function (elem, styles) {
	styles.forEach(function (style) {
		elem.style[style.name] = style.value;
	});
};

const diffStyles = function (elem, styles) {
	// Get style map
	const styleMap = getStyleMap(styles);

	// Get styles to remove
	const remove = Array.prototype.filter.call(elem.style, function (style) {
		const findStyle = styleMap.find(function (newStyle) {
			return newStyle.name === style && newStyle.value === elem.style[style];
		});
		return findStyle === undefined;
	});

	// Add and remove styles
	removeStyles(elem, remove);
	changeStyles(elem, styleMap);
};

const removeAttributes = function (elem, attributes) {
	attributes.forEach(function (attribute) {
		// If the attribute is a class, use className
		// Else if it's style, remove all styles
		// Otherwise, use removeAttribute()
		if (attribute.attributeName === 'class') {
			try {
				// The class name is read only (e.g. for svg)
				elem.className = '';
			} catch (error) {
				elem.removeAttribute('class');
			}
		} else if (attribute.attributeName === 'style') {
			removeStyles(elem, Array.prototype.slice.call(elem.style));
		} else {
			elem.removeAttribute(attribute.attributeName);
		}
	});
};

/**
 * Add attributes to an element
 * @param {HTMLElement}  elem The element
 * @param {Array} attributes The attributes to add
 */
const addAttributes = function (elem, attributes) {
	attributes.forEach(function (attribute) {
		// If the attribute is a class, use className
		// Else if it's style, diff and update styles
		// Otherwise, set the attribute
		if (attribute.attributeName === 'class') {
			try {
				// The class name is read only (e.g. for svg)
				elem.className = attribute.value;
			} catch (error) {
				elem.setAttribute('class', attribute.value || '');
			}
		} else if (attribute.attributeName === 'style') {
			diffStyles(elem, attribute.value);
		} else {
			elem.setAttribute(attribute.attributeName, attribute.value || '');
		}
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
		const getAtt = find(existing.attributes, function (existingAtt) {
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
 * @param  {Object} elem The element details
 * @param  {Object} templateResult
 * @return {HTMLElement|false}        The HTML element
 */
const makeElem = function (elem, templateResult) {
	// Create the element
	let node;
	if (elem.type === 'text') {
		node = document.createTextNode(elem.content);
	} else if (elem.type === 'comment') {
		node = document.createComment(elem.content);
	} else if (elem.isSVG) {
		node = document.createElementNS('http://www.w3.org/2000/svg', elem.type);
	} else {
		node = document.createElement(elem.type);
	}

	// Add attributes
	addAttributes(node, elem.attributes);

	// If the element has child nodes, create them
	// Otherwise, add textContent

	if (elem.children.domMap.length > 0) {
		diff(elem.children, { domMap: [] }, node);
	} else if (templateResult.plainlySetInnerHTML) {
		node.innerHTML = templateResult.innerHTML;
	} else if (elem.type !== 'text') {
		node.textContent = elem.content;
	}
	return node;
};

const isCustomElement = (element) => {
	return element.node.tagName && element.node.tagName.includes('-');
};

/**
 * Diff the existing DOM node versus the template
 * @param  {{ domMap: Array, plainlySetInnerHTML?: boolean, innerHTML?: string }} templateResult A DOM tree map of the template content
 * @param  {{ domMap: array }} domResult      A DOM tree map of the existing DOM node
 * @param  {HTMLElement}  elem        The element to render content into
 */
const diff = function (templateResult, domResult, elem) {
	const templateMap = templateResult.domMap;

	if (templateResult.plainlySetInnerHTML) {
		elem.innerHTML = templateResult.innerHTML;
		return;
	}

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
			const newElement = makeElem(node, node.children);
			elem.appendChild(newElement);
			return;
		}

		// If element is not the same type, replace it with new element
		if (templateMap[index].type !== domMap[index].type) {
			domMap[index].node.parentNode.replaceChild(makeElem(templateMap[index], node.children), domMap[index].node);
			return;
		}

		// If attributes are different, update them
		diffAttributes(templateMap[index], domMap[index]);

		if (node.children.plainlySetInnerHTML && domMap[index]) {
			domMap[index].innerHTML = node.children.innerHTML;
			return;
		}

		// If content is different, update it
		if (templateMap[index].content !== domMap[index].content) {
			if (!isCustomElement(domMap[index])) {
				// ignore custom elements.
				domMap[index].node.textContent = templateMap[index].content;
			}
		}

		// If target element should be empty, wipe it
		if (domMap[index].children.domMap.length > 0 && node.children.domMap.length < 1) {
			if (!isCustomElement(domMap[index])) {
				// ignore custom elements.
				domMap[index].node.innerHTML = '';
			}
			return;
		}

		// If element is empty and shouldn't be, build it up
		// This uses a document fragment to minimize reflows
		if (domMap[index].children.domMap.length === 0 && node.children.domMap.length > 0) {
			if (isCustomElement(domMap[index])) {
				return;
			}

			const fragment = document.createDocumentFragment();
			diff(node.children, domMap[index].children, fragment);
			elem.appendChild(fragment);
			return;
		}

		// If there are existing child elements that need to be modified, diff them
		if (node.children.domMap.length > 0) {
			if (!isCustomElement(node)) {
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
