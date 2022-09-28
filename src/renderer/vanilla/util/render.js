import { hasChildNodes } from '../../../util/DOMHelper';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;

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
	// If the DOM node should be empty, remove all child nodes
	if (hasChildNodes(domNode) && !hasChildNodes(templateNode)) {
		domNode.replaceChildren();
		return;
	}

	// If the DOM node is empty, but should have children, add child nodes from the template node
	if (!hasChildNodes(domNode) && hasChildNodes(templateNode)) {
		domNode.replaceChildren(...templateNode.childNodes);
		return;
	}

	const templateChildNodes = [...templateNode.childNodes];
	const domChildNodes = [...domNode.childNodes];

	let alteredChildNodes = 0;

	// Diff each node in the child node lists
	let length = Math.max(templateChildNodes.length, domChildNodes.length);
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
			domNode.removeChild(domChildNode);
			continue;
		}

		// If DOM node is equal to the template node, don't do anything
		if (domChildNode.isEqualNode(templateChildNode)) {
			continue;
		} else {
			// this doesn't have to be correct, but it could improve things and should not worsen things
			// in the worst case we still have to compare and swap all the elements
			// but in the best case we find the one element that should actually be inserted or removed
			// and from here on, every element that comes after should be the same again

			// we try to delete here (kind of early) instead of at the end
			if (domNode.childNodes.length > templateNode.childNodes.length) {
				domChildNodes.splice(index, 1);
				domNode.removeChild(domChildNode);
				length--;
				index--; // because .childNodes is a live array and will decrease under the hood

				// we might have corrected everything and the parents could be equal again
				// if so, we can skip the rest of children
				if (domNode.childNodes.length === templateNode.childNodes.length && domNode.isEqualNode(templateNode)) {
					return;
				}

				continue;
			}

			// we try to insert here (kind of early) instead of at the end
			// but do not insert before if we are at the end of the list of children
			if (index !== domNode.childNodes.length - 1 && domNode.childNodes.length < templateNode.childNodes.length) {
				domChildNodes.splice(index, 0, templateChildNode);
				domNode.insertBefore(templateChildNode, domChildNode);

				// we might have corrected everything and the parents could be equal again
				// if so, we can skip the rest of children
				if (domNode.childNodes.length === templateNode.childNodes.length && domNode.isEqualNode(templateNode)) {
					return;
				}

				continue;
			}
		}

		// If node types are not the same, replace the DOM node with the template node
		if (templateChildNode.nodeType !== domChildNode.nodeType) {
			domNode.replaceChild(templateChildNode, domChildNode);
			continue;
		}

		// If the node is a Text node or a Comment node, update it
		if (domChildNode.nodeType === TEXT_NODE || domChildNode.nodeType === COMMENT_NODE) {
			domChildNode.textContent = templateChildNode.textContent;
			continue;
		}

		// If the element tag names are not the same, replace the DOM node with the template node
		if (templateChildNode.nodeType === ELEMENT_NODE && templateChildNode.tagName !== domChildNode.tagName) {
			domNode.replaceChild(templateChildNode, domChildNode);
			continue;
		}

		// If the node is an SVG element, don't even think about diffing it, just replace it
		if (templateChildNode.nodeType === ELEMENT_NODE && templateChildNode.tagName === 'SVG') {
			domNode.replaceChild(templateChildNode, domChildNode);
			continue;
		}

		// If the node is an Element node, diff the attributes
		if (templateChildNode.nodeType === ELEMENT_NODE) {
			diffAttributes(templateChildNode, domChildNode);
		}

		// If there are child nodes, diff them recursively
		if (templateChildNode.hasChildNodes()) {
			if (!isTemplateElement(templateChildNode)) {
				diffNodes(templateChildNode, domChildNode);
			}
		}

		alteredChildNodes++;

		// after we have done everything else, the parents could be equal again
		// if so, we can skip the rest of children
		// but if too many children are different, stop it and assume that everything could be changed...
		// if (
		// 	alteredChildNodes < 3 &&
		// 	domNode.childNodes.length === templateNode.childNodes.length &&
		// 	domNode.isEqualNode(templateNode)
		// ) {
		// 	return;
		// }
	}
};

/**
 * Render a template string into the given DOM node
 * @param {string} template
 * @param {Node} domNode
 */
const render = (template, domNode) => {
	const templateNode = convertStringToHTML(template);
	console.time('diff');
	diffNodes(templateNode, domNode);
	console.timeEnd('diff');
};

export { render };
