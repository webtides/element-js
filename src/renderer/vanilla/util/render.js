const NODE_TYPE_COMMENT = 8;
const NODE_TYPE_TEXT = 3;

const _cachedTemplateElements = {};

const convertStringToHTML = (templateString) => {
	//console.time('convertStringToHTML');
	const parser = new DOMParser();
	const document = parser.parseFromString(`<main>${templateString}</main>`, 'text/html');

	//console.timeEnd('convertStringToHTML');
	return document.querySelector('main');
};

/**
 * Create an array of the attributes on an element
 * @param  {NamedNodeMap} attributes The attributes on an element
 * @return {Array}                   The attributes on an element as an array of key/value pairs
 */
const getAttributes = function (attributes) {
	return Array.from(attributes).map((attribute) => {
		return {
			attributeName: attribute.name,
			value: attribute.value,
		};
	});
	// return Array.prototype.map.call(attributes, function (attribute) {
	// 	return {
	// 		attributeName: attribute.name,
	// 		value: attribute.value,
	// 	};
	// });
};

/**
 * Create a DOM Tree Map for an element
 *
 * @param  {HTMLElement}    element The element to map
 * @param  {Boolean} isSVG   If true, node is within an SVG
 * @return {{ domMap: Array, plainlySetInnerHTML?: boolean, innerHTML?: string }} A DOM tree map
 */
const createDOMMap = function (element, isChild = false, isSVG = false, type = 'template') {
	//console.time('createDOMMap');
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
			isChild && isTemplateElement({ node }) ? { domMap: [] } : createDOMMap(node, true, details.isSVG);
		return details;
	});

	//console.timeEnd('createDOMMap');
	return {
		domMap,
	};
};

const createDOMMapWithTreeWalker = function (element, isChild = false, isSVG = false, type = 'template') {
	// TODO: handle "$$plainly-set-inner-html"

	//const domMap = [element];
	const domMap = [];
	const tw = document.createTreeWalker(element);
	let node;
	while ((node = tw.nextNode())) {
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

		domMap.push(details);
	}

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
			element[attribute.attributeName.substring(1)] = attribute.value || '';
			return;
		}

		element.setAttribute(attribute.attributeName, attribute.value || '');
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

const diffAttributesJIT = function (template, target) {
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

	if (element.children.domMap.length > 0) {
		diff(element.children, { domMap: [] }, node);
	} else if (templateResult.plainlySetInnerHTML) {
		node.innerHTML = templateResult.innerHTML;
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

	const elementClass = customElements.get(tagName);
	const isTemplateElement = elementClass && elementClass._$templateElement$ === true;

	if (isTemplateElement) {
		_cachedTemplateElements[tagName] = elementClass;
	}

	return isTemplateElement;
};

/**
 * Diff the existing DOM node versus the template
 * @param  {{ domMap: Array, plainlySetInnerHTML?: boolean, innerHTML?: string }} templateResult A DOM tree map of the template content
 * @param  {{ domMap: array }} domResult      A DOM tree map of the existing DOM node
 * @param  {HTMLElement}  element        The element to render content into
 */
const diff = function (templateResult, domResult, element) {
	//console.time('diff');
	const templateMap = templateResult.domMap;

	if (templateResult.plainlySetInnerHTML) {
		element.innerHTML = templateResult.innerHTML;
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

	// TODO: use TreeWalker here instead of custom nested list of domMaps
	// https://developer.mozilla.org/en-US/docs/Web/API/Document/createTreeWalker
	// https://github.com/patrick-steele-idem/morphdom/issues/15
	// https://stackoverflow.com/questions/64551229/queryselectorall-vs-nodeiterator-vs-treewalker-fastest-pure-js-flat-dom-iterat
	// createDomMap is what takes the longest time...
	// but we don't need it because we have a walkable tree already
	// also when creating the dom map we cannot stop/return early because we don't know
	// if we diff on the fly, we can return early and don't need to recurse any deeper...

	// Diff each item in the templateMap
	templateMap.forEach(function (node, index) {
		// If element doesn't exist, create it
		if (!domMap[index]) {
			// TODO: if I would use a TreWalker I could simply take the element from the template right?!
			// We don't have to create a new one then...
			const newElement = makeElement(node, node.children);
			element.appendChild(newElement);
			return;
		}

		// If element is not the same type, replace it with new element
		if (templateMap[index].type !== domMap[index].type) {
			// TODO: Same here... if I would use a TreWalker I could simply take the element from the template right?!
			// We don't have to create a new one then...
			domMap[index].node.parentNode.replaceChild(
				makeElement(templateMap[index], node.children),
				domMap[index].node,
			);
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
	//console.timeEnd('diff');
};

const diff2 = function (templateResult, domResult, element) {
	const templateMap = templateResult.domMap;

	if (templateResult.plainlySetInnerHTML) {
		element.innerHTML = templateResult.innerHTML;
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

		// If content is different, update it
		if (templateMap[index].content !== domMap[index].content) {
			if (!isTemplateElement(domMap[index])) {
				// ignore custom elements.
				domMap[index].node.textContent = templateMap[index].content;
			}
		}
	});
};

const diffJIT = function (template, target) {
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

		if (templateNode && targetNode) {
			// If element is not the same type, replace it with new element
			if (templateNode.nodeType !== targetNode.nodeType) {
				targetNode.parentNode.replaceChild(templateNode, targetNode);
				continue;
			}

			// If attributes are different, update them
			if (templateNode.nodeType === 1 && targetNode.nodeType === 1) {
				const targetNode = targetChildNodes[index];
				// diffAttributes(
				// 	{ attributes: getAttributes(templateNode.attributes), node: templateNode },
				// 	{ attributes: getAttributes(targetNode.attributes), node: targetNode },
				// );
				diffAttributesJIT(templateNode, targetNode);
			}

			// if (node.children.plainlySetInnerHTML && domMap[index]) {
			// 	domMap[index].innerHTML = node.children.innerHTML;
			// 	return;
			// }

			// If content is different, update it
			if (targetNode.nodeType === 3 && templateNode.nodeType === 3) {
				// If content is different, update it
				if (targetNode.textContent !== templateNode.textContent) {
					targetNode.textContent = templateNode.textContent;
				}
			}

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
					diffJIT(templateNode, targetNode);
				}
			}
		}
	}
};

const diffWithTreeWalker = function (template, target) {
	// for the first render, if target is initially empty
	if (!target.hasChildNodes() && template.hasChildNodes()) {
		// If target is empty but shouldn't be, add child nodes
		target.replaceChildren(...template.childNodes);
		return;
	}

	// if (templateResult.plainlySetInnerHTML) {
	// 	element.innerHTML = templateResult.innerHTML;
	// 	return;
	// }

	// If extra elements in domMap, remove them
	// let count = domMap.length - templateMap.length;
	// if (count > 0) {
	// 	for (; count > 0; count--) {
	// 		domMap[domMap.length - count].node.parentNode.removeChild(domMap[domMap.length - count].node);
	// 	}
	// }

	// https://developer.mozilla.org/en-US/docs/Web/API/Document/createTreeWalker
	// https://github.com/patrick-steele-idem/morphdom/issues/15
	// https://stackoverflow.com/questions/64551229/queryselectorall-vs-nodeiterator-vs-treewalker-fastest-pure-js-flat-dom-iterat

	const templateTreeWalker = document.createTreeWalker(template);
	const targetTreeWalker = document.createTreeWalker(target);
	let templateNode = templateTreeWalker.nextNode();
	let targetNode = targetTreeWalker.nextNode();
	while (templateNode || targetNode) {
		// If target node doesn't exist, create it
		if (!targetNode) {
			target.appendChild(templateNode);
			targetNode = targetTreeWalker.nextNode();
		}

		if (templateNode && targetNode) {
			// TODO: diff attributes...

			if (targetNode.nodeType !== templateNode.nodeType) {
				// If nodes are not the same type, replace it with new node from template
				// const oldTargetNode = targetNode;
				// //const parentTargetNode = targetTreeWalker.parentNode();
				// targetNode.parentNode.replaceChild(templateNode, oldTargetNode);
				// targetNode = targetTreeWalker.nextNode();
				targetNode.parentNode.replaceChild(templateNode, targetNode);
				// TODO: this is a problem here... :(
				// when a list for example has more items now the next target node will not be at the same level...
			} else if (targetNode.nodeType === 1 && templateNode.nodeType === 1) {
				// If child count is different
				if (targetNode.childNodes.length !== templateNode.childNodes.length) {
					targetNode.replaceChildren(...templateNode.childNodes);
					targetNode = targetTreeWalker.nextNode();
				}
			} else if (targetNode.nodeType === 3 && templateNode.nodeType === 3) {
				// If content is different, update it
				if (targetNode.textContent !== templateNode.textContent) {
					targetNode.textContent = templateNode.textContent;
				}
			} else if (targetNode.hasChildNodes() && !templateNode.hasChildNodes()) {
				// If target should be empty, remove all child nodes
				targetNode.replaceChildren();
			} else if (!targetNode.hasChildNodes() && templateNode.hasChildNodes()) {
				// If target is empty but shouldn't be, add child nodes
				targetNode.replaceChildren(...templateNode.childNodes);
			}
		}

		templateNode = templateTreeWalker.nextNode();
		targetNode = targetTreeWalker.nextNode();
	}
};

const render = (template, target) => {
	console.time('render');

	console.time('convertStringToHTML');
	const domTemplate = convertStringToHTML(template);
	console.timeEnd('convertStringToHTML');

	// console.time('templateDOMMap');
	// const templateDOMMap = createDOMMap(domTemplate, false, false, 'template');
	// console.timeEnd('templateDOMMap');

	// console.time('templateDOMMap2');
	// const templateDOMMap2 = createDOMMapWithTreeWalker(domTemplate, false, false, 'template');
	// console.timeEnd('templateDOMMap2');

	// console.time('domMap');
	// const domMap = createDOMMap(target, false, false, 'dom');
	// console.timeEnd('domMap');

	// console.time('domMap2');
	// const domMap2 = createDOMMapWithTreeWalker(target, false, false, 'dom');
	// console.timeEnd('domMap2');

	// console.log('dom maps: ', { templateDOMMap, domMap, templateDOMMap2, domMap2 });

	// console.time('diff');
	// diff(templateDOMMap, domMap, target);
	// console.timeEnd('diff');

	// console.time('diff2');
	// diff2(templateDOMMap, domMap, target);
	// console.timeEnd('diff2');

	console.time('diffJIT');
	diffJIT(domTemplate, target);
	console.timeEnd('diffJIT');

	// console.time('diffWithTreeWalker');
	// diffWithTreeWalker(domTemplate, target);
	// console.timeEnd('diffWithTreeWalker');

	console.timeEnd('render');
};

export { render };
