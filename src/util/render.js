const convertStringToHTML = (templateString) => {
	const parser = new DOMParser();
	const document = parser.parseFromString(templateString, 'text/html');
	return document.body;
};

/**
 * Create an array of the attributes on an element
 * @param  {NamedNodeMap} attributes The attributes on an element
 * @return {Array}                   The attributes on an element as an array of key/value pairs
 */
const getAttributes = function (attributes) {
	return Array.prototype.map.call(attributes, function (attribute) {
		return {
			att: attribute.name,
			value: attribute.value,
		};
	});
};

/**
 * Create a DOM Tree Map for an element
 * @param  {Node}    element The element to map
 * @param  {Boolean} isSVG   If true, node is within an SVG
 * @return {Array}           A DOM tree map
 */
const createDOMMap = function (element, isSVG = false) {
	return Array.prototype.map.call(element.childNodes, function (node) {
		const details = {
			content: node.childNodes && node.childNodes.length > 0 ? null : node.textContent,
			atts: node.nodeType !== 1 ? [] : getAttributes(node.attributes),
			type: node.nodeType === 3 ? 'text' : node.nodeType === 8 ? 'comment' : node.tagName.toLowerCase(),
			node: node,
		};
		details.isSVG = isSVG || details.type === 'svg';
		details.children = createDOMMap(node, details.isSVG);
		return details;
	});
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

const removeAttributes = function (elem, atts) {
	atts.forEach(function (attribute) {
		// If the attribute is a class, use className
		// Else if it's style, remove all styles
		// Otherwise, use removeAttribute()
		if (attribute.att === 'class') {
			elem.className = '';
		} else if (attribute.att === 'style') {
			removeStyles(elem, Array.prototype.slice.call(elem.style));
		} else {
			elem.removeAttribute(attribute.att);
		}
	});
};

/**
 * Add attributes to an element
 * @param {Node}  elem The element
 * @param {Array} atts The attributes to add
 */
const addAttributes = function (elem, atts) {
	atts.forEach(function (attribute) {
		// If the attribute is a class, use className
		// Else if it's style, diff and update styles
		// Otherwise, set the attribute
		if (attribute.att === 'class') {
			elem.className = attribute.value;
		} else if (attribute.att === 'style') {
			diffStyles(elem, attribute.value);
		} else {
			elem.setAttribute(attribute.att, attribute.value || true);
		}
	});
};

/**
 * Diff the attributes on an existing element versus the template
 * @param  {Object} template The new template
 * @param  {Object} existing The existing DOM node
 */
const diffAtts = function (template, existing) {
	// Get attributes to remove
	const remove = existing.atts.filter(function (att) {
		const getAtt = template.atts.find(function (newAtt) {
			return att.att === newAtt.att;
		});
		return getAtt === undefined;
	});

	// Get attributes to change
	const change = template.atts.filter(function (att) {
		const getAtt = find(existing.atts, function (existingAtt) {
			return att.att === existingAtt.att;
		});
		return getAtt === undefined || getAtt.value !== att.value;
	});

	// Add/remove any required attributes
	addAttributes(existing.node, change);
	removeAttributes(existing.node, remove);
};

/**
 * Make an HTML element
 * @param  {Object} elem The element details
 * @return {Node}        The HTML element
 */
const makeElem = function (elem) {
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
	addAttributes(node, elem.atts);

	// If the element has child nodes, create them
	// Otherwise, add textContent
	if (elem.children.length > 0) {
		elem.children.forEach(function (childElem) {
			node.appendChild(makeElem(childElem));
		});
	} else if (elem.type !== 'text') {
		node.textContent = elem.content;
	}

	return node;
};

const isCustomElement = (element) => {
	return element.node?.$$element?.hasOwnUpdateFlow ?? false;
};

/**
 * Diff the existing DOM node versus the template
 * @param  {Array} templateMap A DOM tree map of the template content
 * @param  {Array} domMap      A DOM tree map of the existing DOM node
 * @param  {Node}  elem        The element to render content into
 */
const diff = function (templateMap, domMap, elem) {
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
			elem.appendChild(makeElem(templateMap[index]));
			return;
		}

		// If element is not the same type, replace it with new element
		if (templateMap[index].type !== domMap[index].type) {
			domMap[index].node.parentNode.replaceChild(makeElem(templateMap[index]), domMap[index].node);
			return;
		}

		// If attributes are different, update them
		diffAtts(templateMap[index], domMap[index]);

		// If content is different, update it
		if (templateMap[index].content !== domMap[index].content) {
			if (!isCustomElement(domMap[index])) {
				// ignore custom elements.
				domMap[index].node.textContent = templateMap[index].content;
			}
		}

		// If target element should be empty, wipe it
		if (domMap[index].children.length > 0 && node.children.length < 1) {
			if (!isCustomElement(domMap[index])) {
				// ignore custom elements.
				domMap[index].node.innerHTML = '';
			}
			return;
		}

		// If element is empty and shouldn't be, build it up
		// This uses a document fragment to minimize reflows
		if (domMap[index].children.length < 1 && node.children.length > 0) {
			const fragment = document.createDocumentFragment();
			diff(node.children, domMap[index].children, fragment);
			elem.appendChild(fragment);
			return;
		}

		// If there are existing child elements that need to be modified, diff them
		if (node.children.length > 0) {
			diff(node.children, domMap[index].children, domMap[index].node);
		}
	});
};

const render = (template, target) => {
	diff(createDOMMap(convertStringToHTML(template)), createDOMMap(target), target);

	target.$$element = {
		hasOwnUpdateFlow: true,
	};
};

const html = function (strings, ...keys) {
	let result = [];
	for (let i = 0; i < strings.length; i++) {
		result.push(strings[i]);

		if (i < keys.length) {
			if (typeof keys[i] === 'string') {
				result.push(keys[i]);
			} else if (Array.isArray(keys[i])) {
				result.push(keys[i].join(''));
			} else if (typeof keys[i] === 'function') {
			} else {
				result.push(keys[i].toString());
			}
		}
	}

	return result.join('');
};

export { html, render };
