// minimal Template Instance API surface
// https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md#32-template-parts-and-custom-template-process-callback
import updateNodes from 'swapdom';

const FRAGMENT = 11,
	ELEMENT = 1,
	TEXT = 3,
	COMMENT = 8,
	STRING = 0,
	PART = 1;

let startDelimiter = '{{';
startDelimiter = '<!--{{';
let endDelimiter = '}}';
endDelimiter = '}}-->';

/**
 *
 * @typedef {Object} TemplateProcessCallback
 */

/**
 *
 * @typedef {Object} TemplateTypeInit
 * @property {TemplateProcessCallback} processCallback -
 * @property {TemplateProcessCallback} [createCallback] -
 */

// collect element parts
export const parse = (element, parts = []) => {
	let attr, node, setter, type, value, table, lastParts, slot, slots;

	for (attr of element.attributes || []) {
		if (attr.value.includes(startDelimiter)) {
			setter = { element, attr, parts: [] };
			for ([type, value] of tokenize(attr.value))
				if (!type) setter.parts.push(value);
				else (value = new AttributeTemplatePart(setter, value)), setter.parts.push(value), parts.push(value);
			attr.value = setter.parts.join('');
		}
	}

	for (node of element.childNodes) {
		if (node.nodeType === ELEMENT && !(node instanceof HTMLTemplateElement)) parse(node, parts);
		else {
			// TODO: Attention! The browser will omit the comment strings from a comment node for the value
			// -> <!--{{ 2 }}--> will become only {{ 2 }} as the value :(
			if (node.nodeType === ELEMENT || node.data.includes('{{')) {
				const setter = { parentNode: element, parts: [] };

				if (node.data) {
					for ([type, value] of tokenize(`<!--${node.data}-->`))
						if (!type) setter.parts.push(new Text(value));
						else (value = new NodeTemplatePart(setter, value)), setter.parts.push(value), parts.push(value);
				} else {
					value = new InnerTemplatePart(setter, node);
					setter.parts.push(value), parts.push(value);
				}

				// AD-HOC: {{rows}}<table></table> → <table>{{ rows }}</table>
				// logic: for every empty node in a table there is meant to be part before the table.
				// NOTE: it doesn't cover all possible insertion cases, but the core ones.
				// TODO: it can be extended to detect on the moment of insertion, but it still won't be complete
				// removing for now
				// const tabular = ['caption','colgroup','thead','tbody','tfoot','tr'].map(e=>e+':empty')+''
				// if ((table = node.nextSibling)?.tagName === 'TABLE') {
				//     slots = table.matches(':empty') ? [table] : table.querySelectorAll(tabular)
				//     for (lastParts = []; lastParts.length < slots.length && setter.parts[setter.parts.length - 1] instanceof NodeTemplatePart;)
				//         lastParts.push(setter.parts.pop())
				//
				//     for (slot of slots) {
				//         if (lastParts.length)
				//             parts.pop(), setter.parts.pop(),
				//                 slot.appendChild(new Text(`{{ ${ lastParts.pop().expression } }}`)),
				//                 setter.parts.push(new Text) // we have to stub removed field to keep children count
				//     }
				// }

				node.replaceWith(...setter.parts.flatMap((part) => part.replacementNodes || [part]));
			}
		}
	}

	return parts;
};

// parse string with template fields
function tokenize(text) {
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
			if (value) tokens.push([STRING, value]);
			value = '';
			i += startDelimiter.length - 1;
		}
		//else if (char === '}' && text[i+1] === '}' && text[i-1] !== '\\' && !--open) {
		else if (char === '}' && text[i + 1] === '}' && text[i - 1] !== '\\' && !--open) {
			tokens.push([PART, value.trim()]);
			value = '';
			i += endDelimiter.length - 1;
		} else value += char || ''; // text[i] is undefined if i+=2 caught
	}

	if (value) {
		tokens.push([STRING, (open > 0 ? startDelimiter : '') + value]);
	}

	return (mem[text] = tokens);
}
const mem = {};

export const defaultProcessor = {
	processCallback(instance, parts, state) {
		if (!state) return;
		for (const part of parts) {
			if (part.expression in state) {
				const value = state[part.expression];

				if (
					typeof value === 'boolean' &&
					part instanceof AttributeTemplatePart &&
					typeof part.element[part.attributeName] === 'boolean'
				) {
					// boolean attribute
					part.booleanValue = value;
				} else if (value instanceof TemplateResult && part instanceof NodeTemplatePart) {
					// sub-template
					value.renderInto(part);
				} else if (value instanceof DocumentFragment && part instanceof NodeTemplatePart) {
					// document-fragment
					if (value.childNodes.length) part.replace(...value.childNodes);
				} else if (typeof value === 'object' && Symbol.iterator in value) {
					// isIterable
					if (part instanceof NodeTemplatePart) {
						const nodes = [];
						for (const item of value) {
							if (item instanceof TemplateResult) {
								// TODO: this will always create new fragments and never reuse the ones already rendered
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
					} else {
						part.value = Array.from(value).join(' ');
					}
				} else {
					part.value = value;
				}
			}
		}
	},
};

export class TemplateInstance extends DocumentFragment {
	#parts;
	#processor;

	/**
	 * @param {HTMLTemplateElement} template
	 * @param {unknown} values
	 * @param {TemplateTypeInit} processor
	 */
	constructor(template, values, processor = defaultProcessor) {
		super();
		this.appendChild(template.content.cloneNode(true));
		this.#parts = parse(this);
		this.#processor = processor;

		values ||= {};
		processor.createCallback?.(this, this.#parts, values);
		processor.processCallback(this, this.#parts, values);
	}

	update(values) {
		this.#processor.processCallback(this, this.#parts, values);
	}
}

export class TemplatePart {
	constructor(setter, expr) {
		(this.setter = setter), (this.expression = expr);
	}
	toString() {
		return this.value;
	}
}

export class AttributeTemplatePart extends TemplatePart {
	#value = '';
	get attributeName() {
		return this.setter.attr.name;
	}
	get attributeNamespace() {
		return this.setter.attr.namespaceURI;
	}
	get element() {
		return this.setter.element;
	}
	get value() {
		return this.#value;
	}
	set value(newValue) {
		if (this.#value === newValue) return; // save unnecessary call
		this.#value = newValue;
		const { attr, element, parts } = this.setter;
		if (parts.length === 1) {
			// fully templatized
			if (newValue == null) element.removeAttributeNS(attr.namespaceURI, attr.name);
			else element.setAttributeNS(attr.namespaceURI, attr.name, newValue);
		} else element.setAttributeNS(attr.namespaceURI, attr.name, parts.join(''));
	}
	get booleanValue() {
		this.setter.element.hasAttribute(this.setter.attr.name);
	}
	set booleanValue(value) {
		if (this.setter.parts.length === 1) this.value = value ? '' : null;
		else throw new DOMException('Value is not fully templatized');
	}
}

export class NodeTemplatePart extends TemplatePart {
	#nodes = [new Text()];
	get replacementNodes() {
		return this.#nodes;
	}
	get parentNode() {
		return this.setter.parentNode;
	}
	get nextSibling() {
		return this.#nodes[this.#nodes.length - 1].nextSibling;
	}
	get previousSibling() {
		return this.#nodes[0].previousSibling;
	}
	// FIXME: not sure why do we need string serialization here? Just because parent class has type DOMString?
	get value() {
		return this.#nodes.map((node) => node.textContent).join('');
	}
	set value(newValue) {
		this.replace(newValue);
	}
	replace(...nodes) {
		// replace current nodes with new nodes.
		nodes = nodes
			.flat()
			.flatMap((node) =>
				node == null
					? [new Text()]
					: node.forEach
					? [...node]
					: node.nodeType === FRAGMENT
					? [...node.childNodes]
					: node.nodeType
					? [node]
					: [new Text(node)],
			);
		if (!nodes.length) nodes.push(new Text()); // add placeholder if all nodes are removed
		// since template instance could've inserted, parent node refers to empty document fragment
		this.#nodes = updateNodes(this.#nodes[0].parentNode, this.#nodes, nodes, this.nextSibling);
	}
	replaceHTML(html) {
		const fragment = this.parentNode.cloneNode();
		fragment.innerHTML = html;
		this.replace(fragment.childNodes);
	}
}

export class InnerTemplatePart extends NodeTemplatePart {
	directive;
	constructor(setter, template) {
		let directive = template.getAttribute('directive') || template.getAttribute('type'),
			expression = template.getAttribute('expression') || template.getAttribute(directive) || '';
		//if (expression.startsWith('{{')) expression = expression.trim().slice(2,-2).trim()
		// TODO: 2 or 6 ?!
		if (expression.startsWith(startDelimiter)) expression = expression.trim().slice(6, -6).trim();
		super(setter, expression);
		this.template = template;
		this.directive = directive;
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
	 * @returns {HTMLTemplateElement}
	 */
	get template() {
		if (templates.has(this.strings)) {
			return templates.get(this.strings);
		} else {
			const template = document.createElement('template');
			const end = this.strings.length - 1;
			template.innerHTML = this.strings.reduce(
				(str, cur, i) => str + cur + (i < end ? `${startDelimiter} ${i} ${endDelimiter}` : ''),
				'',
			);
			templates.set(this.strings, template);
			return template;
		}
	}

	/**
	 * @param {Node | NodeTemplatePart} element
	 */
	renderInto(element) {
		// console.log('renderInto', element);
		const template = this.template;
		if (renderedTemplates.get(element) !== template) {
			console.log('renderInto NO TEMPLATE');
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
		// console.log('renderInto YES TEMPLATE');
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
