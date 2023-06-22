/**
 * @typedef {Object} TemplateProcessCallback
 */

/**
 * @typedef {Object} TemplateTypeInit
 * @property {TemplateProcessCallback} processCallback -
 * @property {TemplateProcessCallback} [createCallback] -
 */

/**
 * @typedef {Object} PartProcessor
 */

/**
 * @param {PartProcessor} processPart
 * @returns {TemplateTypeInit}
 */
export function createProcessor(processPart) {
	return {
		/**
		 * @param {TemplateInstance} _
		 * @param {Iterable<TemplatePart>} parts
		 * @param {unknown} params
		 */
		processCallback(_, parts, params) {
			if (typeof params !== 'object' || !params) return;
			for (const part of parts) {
				if (part.expression in params) {
					const value = params[part.expression] ?? '';
					processPart(part, value);
				}
			}
		},
	};
}

/**
 * @param {TemplatePart} part
 * @param {unknown} value
 */
export function processPropertyIdentity(part, value) {
	part.value = String(value);
}

/**
 * @param {TemplatePart} part
 * @param {unknown} value
 * @returns {boolean}
 */
export function processBooleanAttribute(part, value) {
	if (
		typeof value === 'boolean' &&
		part instanceof AttributeTemplatePart &&
		typeof part.element[part.attributeName] === 'boolean'
	) {
		part.booleanValue = value;
		return true;
	}
	return false;
}

export const propertyIdentity = createProcessor(processPropertyIdentity);
export const propertyIdentityOrBooleanAttribute = createProcessor((part, value) => {
	processBooleanAttribute(part, value) || processPropertyIdentity(part, value);
});

import { processDirective } from '@github/jtml/lib/directive.js';
import { processEvent } from '@github/jtml/lib/events.js';

/**
 * @param {unknown} value
 * @returns {value is Iterable<unknown>}
 */
function isIterable(value) {
	//value as unknown as Record<symbol, unknown>
	return typeof value === 'object' && Symbol.iterator in value;
}

/**
 *
 * @param {TemplatePart} part
 * @param {unknown} value
 * @returns {boolean}
 */
export function processIterable(part, value) {
	if (!isIterable(value)) return false;
	if (part instanceof NodeTemplatePart) {
		const nodes = [];
		for (const item of value) {
			if (item instanceof TemplateResult) {
				const fragment = document.createDocumentFragment();
				item.renderInto(fragment);
				nodes.push(...fragment.childNodes);
			} else if (item instanceof DocumentFragment) {
				nodes.push(...item.childNodes);
			} else {
				nodes.push(String(item));
			}
		}
		if (nodes.length) part.replace(...nodes);
		return true;
	} else {
		part.value = Array.from(value).join(' ');
		return true;
	}
}

/**
 * @param {TemplatePart} part
 * @param {unknown} value
 * @returns {boolean}
 */
export function processDocumentFragment(part, value) {
	if (value instanceof DocumentFragment && part instanceof NodeTemplatePart) {
		if (value.childNodes.length) part.replace(...value.childNodes);
		return true;
	}
	return false;
}

/**
 * @param {TemplatePart} part
 * @param {unknown} value
 * @returns {boolean}
 */
export function processSubTemplate(part, value) {
	if (value instanceof TemplateResult && part instanceof NodeTemplatePart) {
		value.renderInto(part);
		return true;
	}
	return false;
}

/**
 *
 * @param {TemplatePart} part
 * @param {unknown} value
 */
export function processPart(part, value) {
	processDirective(part, value) ||
		processBooleanAttribute(part, value) ||
		processEvent(part, value) ||
		processSubTemplate(part, value) ||
		processDocumentFragment(part, value) ||
		processIterable(part, value) ||
		processPropertyIdentity(part, value);
}

export const defaultProcessor = createProcessor(processPart);

// const mem = new Map()
// export function parse(text) {
//     if (mem.has(text)) return mem.get(text)
//     const length = text.length
//     let lastPos = 0
//     let tokenStart = 0
//     let open = 0
//     const items = []
//     for (let i = 0; i < length; i += 1) {
//         const char = text[i]
//         const lookAhead = text[i + 1]
//         const lookBehind = text[i - 1]
//         //if (char === '{' && lookAhead === '{' && lookBehind !== '\\') {
//         if (char === '<' && text[i + 4] === '{' && lookBehind !== '\\') {
//             open += 1
//             if (open === 1) tokenStart = i
//             i += 5
//         }
//         else if (char === '}' && lookAhead === '}' && lookBehind !== '\\' && open) {
//             open -= 1
//             if (open === 0) {
//                 if (tokenStart > lastPos) {
//                     items.push(
//                         Object.freeze({
//                             type: 'string',
//                             start: lastPos,
//                             end: tokenStart,
//                             value: text.slice(lastPos, tokenStart)
//                         })
//                     )
//                     lastPos = tokenStart
//                 }
//                 items.push(
//                     Object.freeze({
//                         type: 'part',
//                         start: tokenStart,
//                         //end: i + 2,
//                         end: i + 5,
//                         //value: text.slice(lastPos + 2, i).trim()
//                         value: text.slice(lastPos + 5, i).trim()
//                     })
//                 )
//                 i += 4
//                 lastPos = i + 4
//             }
//         }
//     }
//     if (lastPos < length)
//         items.push(Object.freeze({type: 'string', start: lastPos, end: length, value: text.slice(lastPos, length)}))
//     mem.set(text, Object.freeze(items))
//     return mem.get(text)
// }

function parse(text) {
	let value = '',
		open = 0,
		tokens = mem[text],
		i = 0;

	if (tokens) return tokens;
	else tokens = [];

	for (; i < text.length; i++) {
		const char = text[i];
		//if (char === '{' && text[i+1] === '{' && text[i-1] !== '\\' && ++open==1) {
		if (
			char === '<' &&
			text[i + 1] === '!' &&
			text[i + 4] === '{' &&
			text[i - 1] !== '\\' &&
			text[i + 6] &&
			++open == 1
		) {
			if (value)
				tokens.push(
					Object.freeze({
						type: 'string',
						value: value,
					}),
				);
			value = '';
			i += 5;
		}
		//else if (char === '}' && text[i+1] === '}' && text[i-1] !== '\\' && !--open) {
		else if (char === '}' && text[i + 1] === '}' && text[i - 1] !== '\\' && !--open) {
			tokens.push(
				Object.freeze({
					type: 'part',
					value: value.trim(),
				}),
			);
			value = '';
			i += 4;
		} else value += char || ''; // text[i] is undefined if i+=2 caught
	}

	if (value) {
		tokens.push([STRING, (open > 0 ? '<!--{{' : '') + value]);
	}

	return (mem[text] = tokens);
}
const mem = {};

/**
 * @param {DocumentFragment} el
 * @returns {Generator<TemplatePart>}
 */
function* collectParts(el) {
	const walker = el.ownerDocument.createTreeWalker(
		el,
		NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_ELEMENT,
		null,
		false,
	);
	let node;
	while ((node = walker.nextNode())) {
		if (node instanceof Element && node.hasAttributes()) {
			for (let i = 0; i < node.attributes.length; i += 1) {
				const attr = node.attributes.item(i);
				if (attr && attr.value.includes('<!--{{')) {
					const valueSetter = new AttributeValueSetter(node, attr);
					for (const token of parse(attr.value)) {
						if (token.type === 'string') {
							valueSetter.append(token.value);
						} else {
							const part = new AttributeTemplatePart(valueSetter, token.value);
							valueSetter.append(part);
							yield part;
						}
					}
				}
			}
		} else if (node.nodeType === 8 && node.textContent && node.textContent.includes('{{')) {
			const parsed = parse(`<!--${node.textContent}-->`);
			for (let i = 0; i < parsed.length; i += 1) {
				const token = parsed[i];
				if (token.end < node.textContent.length) node.splitText(token.end);
				if (token.type === 'part') yield new NodeTemplatePart(node, token.value);
				break;
			}
		}
	}
}

/** @type {Map<TemplateInstance, TemplateTypeInit>} */
const processors = new WeakMap();
/** @type {Map<TemplateInstance, Iterable<TemplatePart>>} */
const parts = new WeakMap();
export class TemplateInstance extends DocumentFragment {
	/**
	 * @param {HTMLTemplateElement} template
	 * @param {unknown} params
	 * @param {TemplateTypeInit} processor
	 */
	constructor(template, params, processor = propertyIdentity) {
		super();
		// This is to fix an inconsistency in Safari which prevents us from
		// correctly sub-classing DocumentFragment.
		// https://bugs.webkit.org/show_bug.cgi?id=195556
		if (Object.getPrototypeOf(this) !== TemplateInstance.prototype) {
			Object.setPrototypeOf(this, TemplateInstance.prototype);
		}
		this.appendChild(template.content.cloneNode(true));
		parts.set(this, Array.from(collectParts(this)));
		processors.set(this, processor);
		processors.get(this).createCallback?.(this, parts.get(this), params);
		processors.get(this).processCallback(this, parts.get(this), params);
	}

	/**
	 * @param {unknown} params
	 */
	update(params) {
		processors.get(this).processCallback(this, parts.get(this), params);
	}
}

/**
 * @typedef {Object} TemplatePart
 * @property {string} expression -
 * @property {string | null} value -
 */

/** @type {Map<AttributeTemplatePart, AttributeValueSetter>} */
const setters = new WeakMap();
/** @type {Map<AttributeTemplatePart, string>} */
const values = new WeakMap();

/**
 * @implements {TemplatePart}
 */
export class AttributeTemplatePart {
	/**
	 * @param {AttributeValueSetter} setter
	 * @param {string} expression
	 */
	constructor(setter, expression) {
		this.expression = expression;
		setters.set(this, setter);
		setter.updateParent('');
	}

	/**
	 * @returns {string}
	 */
	get attributeName() {
		return setters.get(this).attr.name;
	}

	/**
	 * @returns {string | null}
	 */
	get attributeNamespace() {
		return setters.get(this).attr.namespaceURI;
	}

	/**
	 * @returns {string | null}
	 */
	get value() {
		return values.get(this);
	}

	/**
	 * @param {string | null} value
	 */
	set value(value) {
		values.set(this, value || '');
		setters.get(this).updateParent(value);
	}

	/**
	 * @returns {Element}
	 */
	get element() {
		return setters.get(this).element;
	}

	/**
	 * @returns {boolean}
	 */
	get booleanValue() {
		return setters.get(this).booleanValue;
	}

	/**
	 * @returns {boolean}
	 */
	set booleanValue(value) {
		setters.get(this).booleanValue = value;
	}
}

export class AttributeValueSetter {
	/** @type {Array<string | AttributeTemplatePart>} */
	partList = [];

	/**
	 * @param {Element} element
	 * @param {Attr} attr
	 */
	constructor(element, attr) {
		this.element = element;
		this.attr = attr;
	}

	/**
	 * @returns {boolean}
	 */
	get booleanValue() {
		return this.element.hasAttributeNS(this.attr.namespaceURI, this.attr.name);
	}

	/**
	 * @param {boolean} value
	 */
	set booleanValue(value) {
		if (this.partList.length !== 1) {
			throw new DOMException('Operation not supported', 'NotSupportedError');
		}
		this.partList[0].value = value ? '' : null;
		//as AttributeTemplatePart
	}

	/**
	 * @param {string | AttributeTemplatePart} part
	 */
	append(part) {
		this.partList.push(part);
	}

	/**
	 * @param {string | null} partValue
	 */
	updateParent(partValue) {
		if (this.partList.length === 1 && partValue === null) {
			this.element.removeAttributeNS(this.attr.namespaceURI, this.attr.name);
		} else {
			const str = this.partList.map((s) => (typeof s === 'string' ? s : s.value)).join('');
			this.element.setAttributeNS(this.attr.namespaceURI, this.attr.name, str);
		}
	}
}

/** @type {Map<NodeTemplatePart, ChildNode[]>} */
const parts2 = new WeakMap();
/**
 * @implements {TemplatePart}
 */
export class NodeTemplatePart {
	/**
	 *
	 * @param {ChildNode} node
	 * @param {string} expression
	 */
	constructor(node, expression) {
		this.expression = expression;
		parts2.set(this, [node]);
		node.textContent = '';
	}

	/**
	 * @returns {string}
	 */
	get value() {
		return parts2
			.get(this)
			.map((node) => node.textContent)
			.join('');
	}

	/**
	 * @param {string} string
	 */
	set value(string) {
		this.replace(string);
	}

	/**
	 * @returns {ChildNode | null}
	 */
	get previousSibling() {
		return parts2.get(this)[0].previousSibling;
	}

	/**
	 * @returns {ChildNode | null}
	 */
	get nextSibling() {
		return parts2.get(this)[parts2.get(this).length - 1].nextSibling;
	}

	/**
	 * @param {Array<string | ChildNode>} nodes
	 */
	replace(...nodes) {
		/** @type {ChildNode[]} */
		const normalisedNodes = nodes.map((node) => {
			if (typeof node === 'string') return new Text(node);
			return node;
		});
		if (!normalisedNodes.length) normalisedNodes.push(new Text(''));
		parts2.get(this)[0].before(...normalisedNodes);
		for (const part of parts2.get(this)) part.remove();
		parts2.set(this, normalisedNodes);
	}
}

/** @type {Map<TemplateStringsArray, HTMLTemplateElement>} */
const templates = new WeakMap();
/** @type {Map<Node | NodeTemplatePart, HTMLTemplateElement>} */
const renderedTemplates = new WeakMap();
/** @type {Map<Node | NodeTemplatePart, TemplateInstance>} */
const renderedTemplateInstances = new WeakMap();

export class TemplateResult {
	/**
	 *
	 * @param {TemplateStringsArray} strings
	 * @param {unknown[]} values
	 * @param {TemplateTypeInit} processor
	 */
	constructor(strings, values, processor) {
		this.strings = strings;
		this.values = values;
		this.processor = processor;
	}

	/**
	 *
	 * @returns {HTMLTemplateElement}
	 */
	get template() {
		if (templates.has(this.strings)) {
			return templates.get(this.strings);
		} else {
			const template = document.createElement('template');
			const end = this.strings.length - 1;
			template.innerHTML = this.strings.reduce(
				(str, cur, i) => str + cur + (i < end ? `<!--{{ ${i} }}-->` : ''),
				'',
			);
			templates.set(this.strings, template);
			return template;
		}
	}

	/**
	 *
	 * @param {Node | NodeTemplatePart} element
	 */
	renderInto(element) {
		const template = this.template;
		if (renderedTemplates.get(element) !== template) {
			renderedTemplates.set(element, template);
			const instance = new TemplateInstance(template, this.values, this.processor);
			renderedTemplateInstances.set(element, instance);
			if (element instanceof NodeTemplatePart) {
				element.replace(...instance.children);
			} else {
				element.appendChild(instance);
			}
			return;
		}
		// as unknown as Record<string, unknown>
		renderedTemplateInstances.get(element).update(this.values);
	}
}

/**
 * @param {TemplateStringsArray} strings
 * @param {unknown[]} values
 * @returns {TemplateResult}
 */
export function html(strings, ...values) {
	return new TemplateResult(strings, values, defaultProcessor);
}

/**
 * @param {TemplateResult} result
 * @param {Node | NodeTemplatePart} element
 */
export function render(result, element) {
	console.time('diff');
	result.renderInto(element);
	console.timeEnd('diff');
}
