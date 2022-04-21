// import domdiff from '../../domdiff/index';
// import udomdiff from '../../udomdiff/index';

let isEqual = 0;
let isNotEqual = 0;

const hashCache = new Map();

const hash = function (string) {
	let hash;
	for (let index = 0; index < string.length; index++) hash = (Math.imul(31, hash) + string.charCodeAt(index)) | 0;
	return hash;
};

const hashForNode = function (node) {
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

const _cachedTemplateElements = {};

const convertStringToHTML = (templateString) => {
	const parser = new DOMParser();
	const document = parser.parseFromString(`<main>${templateString}</main>`, 'text/html');

	return document.querySelector('main');
};

/**
 * Diff the attributes on the target DOM node versus the template DOM node
 * @param  {Element} template The new template
 * @param  {Element} target The existing DOM node
 */
const diffAttributes = function (template, target) {
	const templateAttributes = {};
	for (const attribute of Array.from(template.attributes)) {
		templateAttributes[attribute.name] = attribute.value;
	}

	const targetAttributes = {};
	for (const attribute of Array.from(target.attributes)) {
		targetAttributes[attribute.name] = attribute.value;
	}

	// TODO: maybe we can compare them and return early if the are the same?!

	// remove attributes
	for (const attributeName of Object.keys(targetAttributes)) {
		if (!templateAttributes[attributeName]) {
			target.removeAttribute(attributeName);
		}
	}

	// add/update attributes
	for (const attributeName of Object.keys(templateAttributes)) {
		// TODO: handle attributes with "." aka properties...
		target.setAttribute(attributeName, templateAttributes[attributeName] || '');
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

	// If extra elements in target, add dummy elements to template so that the length will match
	let count = targetChildNodes.length - templateChildNodes.length;
	count = targetChildNodes.length - templateChildNodes.length;
	if (count > 0) {
		const targetHashes = [];
		const templateHashes = [];

		hashCache.clear();
		for (const childNode of targetChildNodes) {
			targetHashes.push(hashForNode(childNode));
		}

		hashCache.clear();
		for (const childNode of templateChildNodes) {
			templateHashes.push(hashForNode(childNode));
		}

		console.log('nodes');
		console.log(targetChildNodes, templateChildNodes);

		console.log('hashes');
		console.log(targetHashes, templateHashes);

		const missingNodes = targetHashes.filter(function (el) {
			return templateHashes.indexOf(el) < 0;
		});

		const missingIndexes = missingNodes.map(function (node) {
			return targetHashes.indexOf(node);
		});

		for (const missingIndex of missingIndexes) {
			const node = document.createElement('span');
			node['delete-me'] = true;
			templateChildNodes.splice(missingIndex, 0, node);
		}

		// console.log('missingIndexes', missingIndexes);
	}

	// Diff each node in the template child nodes array
	const length = templateChildNodes.length;
	for (let index = 0; index < length; index++) {
		const templateNode = templateChildNodes[index];
		const targetNode = targetChildNodes[index];

		// If template node is dummy node, remove node in target
		if (templateNode['delete-me']) {
			targetNode.parentNode.removeChild(targetNode);
			continue;
		}

		// If target node doesn't exist, create it
		if (!targetChildNodes[index]) {
			target.appendChild(templateNode);
			continue;
		}

		// If target node is equal to the template node, don't do anything
		if (targetNode.isEqualNode(templateNode)) {
			//console.log('isEqualNode');
			isEqual++;
			continue;
		} else {
			isNotEqual++;
			//console.log('NOT isEqualNode');
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

	isEqual = 0;
	isNotEqual = 0;

	console.time('diff');
	diff(domTemplate, target);
	console.timeEnd('diff');

	console.log('equals', isEqual, isNotEqual);

	// console.time('domdiff');
	// domdiff(target, [...target.childNodes], [...domTemplate.childNodes]);
	// console.timeEnd('domdiff');

	// console.time('udomdiff');
	// udomdiff(target, [...target.childNodes], [...domTemplate.childNodes]);
	// console.timeEnd('udomdiff');

	console.timeEnd('render');
};

export { render };
