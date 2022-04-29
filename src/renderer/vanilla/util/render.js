const _cachedTemplateElements = {};

let countChanges = 0;

const hashCache1 = new Map();
const hashCache2 = new Map();

const hash = function (string) {
	let hash;
	for (let index = 0; index < string.length; index++) hash = (Math.imul(31, hash) + string.charCodeAt(index)) | 0;
	return hash;
};

const hashForNode = function (node, hashCache) {
	let nodeValue = node.outerHTML || node.textContent || 'whitespace';

	let hashValue = hash(`${nodeValue}`).toString();

	if (hashCache.has(hashValue)) {
		const previousIndex = hashCache.get(hashValue);
		hashCache.set(hashValue, previousIndex + 1);
		hashValue = `${hashValue}_${previousIndex + 1}`;
	} else {
		hashCache.set(hashValue, 0);
	}

	return hashValue;
};

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
	console.log('diff');
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
		} else {
			countChanges++;
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

const diffWithHashing = function (templateNode, domNode) {
	console.log('diffWithHashing');
	const domChildNodes = [...domNode.childNodes];
	const templateChildNodes = [...templateNode.childNodes];

	// console.log('nodes');
	// console.log(domChildNodes, templateChildNodes);

	const domChildNodesLength = domChildNodes.length;
	const templateChildNodesLength = templateChildNodes.length;

	// TODO: what about plainlySetInnerHTML ?!
	// TODO: what about SVGs ?! do they need special handling?!

	// TODO: can we assume that there will never be 0 elements because at least there is always 1 text node with whitespace?!

	if (domChildNodes.length !== templateChildNodes.length) {
		const domChildNodesIsEmpty =
			domChildNodesLength === 0 ||
			(domChildNodesLength === 1 &&
				domChildNodes[0].nodeType === 3 &&
				domChildNodes[0].textContent.trim().length === 0);
		const templateChildNodesIsEmpty =
			templateChildNodesLength === 0 ||
			(templateChildNodesLength === 1 &&
				templateChildNodes[0].nodeType === 3 &&
				templateChildNodes[0].textContent.trim().length === 0);

		if (domChildNodesIsEmpty && !templateChildNodesIsEmpty) {
			// If the DOM node is empty, but should have children, add child nodes from the template node
			domNode.replaceChildren(...templateChildNodes);
			return;
		} else if (!domChildNodesIsEmpty && templateChildNodesIsEmpty) {
			// If the DOM node should be empty, remove all child nodes
			domNode.replaceChildren();
			return;
		} else {
			// we cannot simply replaceChildren... we have to hash
			const domHashes = new Map();
			const templateHashes = new Map();

			hashCache1.clear();
			for (let index = 0; index < domChildNodesLength; index++) {
				const childNode = domChildNodes[index];
				const hash = hashForNode(childNode, hashCache1);
				domHashes.set(hash, index);
			}

			hashCache2.clear();
			for (let index = 0; index < templateChildNodesLength; index++) {
				const childNode = templateChildNodes[index];
				const hash = hashForNode(childNode, hashCache2);
				templateHashes.set(hash, index);
			}

			// console.log('children');
			// console.log(domChildNodes, templateChildNodes);

			// console.log('hashes');
			// console.log([...domHashes.entries()], [...templateHashes.entries()]);

			for (const templateHashKey of templateHashes.keys()) {
				domHashes.delete(templateHashKey);
			}

			for (const missingIndex of domHashes.values()) {
				templateChildNodes.splice(missingIndex, 0, document.createElement('delete-me'));
				//templateChildNodes.push(document.createElement('delete-me'));
			}

			// console.log('missing keys', [...domHashes.values()]);

			// console.log('hashes');
			// console.log([...domHashes.entries()], [...templateHashes.entries()]);
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
		} else {
			countChanges++;
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

const diffWithHashingJIT = function (templateNode, domNode) {
	console.log('diffWithHashingJIT');
	const domChildNodes = [...domNode.childNodes];
	const templateChildNodes = [...templateNode.childNodes];

	const domChildHashes = [];
	const templateChildHashes = [];

	const domChildNodesLength = domChildNodes.length;
	const templateChildNodesLength = templateChildNodes.length;

	// TODO: what about plainlySetInnerHTML ?!
	// TODO: what about SVGs ?! do they need special handling?!

	// TODO: can we assume that there will never be 0 elements because at least there is always 1 text node with whitespace?!

	if (domChildNodes.length !== templateChildNodes.length) {
		const domChildNodesIsEmpty =
			domChildNodesLength === 0 ||
			(domChildNodesLength === 1 &&
				domChildNodes[0].nodeType === 3 &&
				domChildNodes[0].textContent.trim().length === 0);
		const templateChildNodesIsEmpty =
			templateChildNodesLength === 0 ||
			(templateChildNodesLength === 1 &&
				templateChildNodes[0].nodeType === 3 &&
				templateChildNodes[0].textContent.trim().length === 0);

		if (domChildNodesIsEmpty && !templateChildNodesIsEmpty) {
			// If the DOM node is empty, but should have children, add child nodes from the template node
			domNode.replaceChildren(...templateChildNodes);
			return;
		} else if (!domChildNodesIsEmpty && templateChildNodesIsEmpty) {
			// If the DOM node should be empty, remove all child nodes
			domNode.replaceChildren();
			return;
		} else {
			// we cannot simply replaceChildren... we have to hash
			const domHashes = new Map();
			const templateHashes = new Map();

			hashCache1.clear();
			for (let index = 0; index < domChildNodesLength; index++) {
				const childNode = domChildNodes[index];
				const hash = hashForNode(childNode, hashCache1);
				domHashes.set(hash, index);
				domChildHashes.push(hash);
			}

			hashCache2.clear();
			for (let index = 0; index < templateChildNodesLength; index++) {
				const childNode = templateChildNodes[index];
				const hash = hashForNode(childNode, hashCache2);
				templateHashes.set(hash, index);
				templateChildHashes.push(hash);
			}

			// console.log('children');
			// console.log(domChildNodes, templateChildNodes);

			// console.log('hashes');
			// console.log([...domHashes.entries()], [...templateHashes.entries()]);

			// TEST to loop from both sides (start and end of the array)
			const missingIndexes = [];
			for (let index = 0; index < domChildNodes.length / 2; index++) {
				const startIndex = index;
				const endIndex = domChildNodes.length - 1 - index;

				const startKey = domChildHashes[startIndex];
				if (!templateHashes.has(startKey)) {
					missingIndexes.push(startIndex);

					if (missingIndexes.length === domChildNodesLength - templateChildNodesLength) {
						break;
					}
				}

				const endKey = domChildHashes[endIndex];
				if (!templateHashes.has(endKey)) {
					missingIndexes.push(endIndex);

					if (missingIndexes.length === domChildNodesLength - templateChildNodesLength) {
						break;
					}
				}
			}

			console.log('missing keys', missingIndexes);

			for (const missingIndex of missingIndexes) {
				// domNode.removeChild(domChildNodes[missingIndex]);
				// domChildNodes.splice(missingIndex, 1);

				templateChildNodes.splice(missingIndex, 0, document.createElement('delete-me'));
				//templateChildNodes.push(document.createElement('delete-me'));
			}

			// console.log('missing keys', [...domHashes.values()]);

			// console.log('nodes');
			// console.log(domChildNodes, templateChildNodes);
			//
			// console.log('hashes');
			// console.log([...domHashes.entries()], [...templateHashes.entries()]);
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
		} else {
			countChanges++;
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

	countChanges = 0;
	console.time('diff');
	diffWithHashingJIT(templateNode, domNode);
	console.timeEnd('diff');
	console.log('countChanges', countChanges);

	console.timeEnd('render');
};

export { render };
