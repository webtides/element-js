import { COMMENT_NODE, getNodePath } from '../../../util/DOMHelper';
import { encodeAttribute } from '../../../util/AttributeParser.js';
import { ChildNodePart } from './ChildNodePart.js';
import { PersistentFragment } from './PersistentFragment.js';

// the prefix is used to tag and reference nodes and attributes to create parts with updates
// attributes: dom-part-1="attribute-name"
// nodes|fragments|arrays (as comment nodes): <!--dom-part-2-->
export const prefix = 'dom-part-';

// match nodes|elements that cannot contain comment nodes and must be handled via text-only updates directly.
export const textOnly = /^(?:textarea|script|style|title|plaintext|xmp)$/;

const empty = /^(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)$/i;
const elements = /<([a-z]+[a-z0-9:._-]*)([^>]*?)(\/?)>/g;
const attributes = /([^\s\\>"'=]+)\s*=\s*(['"]?)\x01/g;
const partPositions = /[\x01\x02]/g;
// \x01 Node.ELEMENT_NODE
// \x02 Node.ATTRIBUTE_NODE

const rename = /([^\s>]+)[\s\S]*$/;
const interpolation = new RegExp(`(<!--${prefix}(\\d+)--><!--/${prefix}(\\d+)-->|\\s*${prefix}(\\d+)=([^\\s>]))`, 'g');

// TODO: path for regex for multiple interpolations within attribute:
// elements: https://regex101.com/r/vjWWsx/1
// attributes: https://regex101.com/r/zG0qAI/1
// for attributes we still need to think about variations without the quotes

/**
 * Given a template, find part positions as both nodes and attributes and
 * return a string with placeholders as either comment nodes or named attributes.
 * @param {string[]} template a template literal tag array
 * @param {string} prefix prefix to use per each comment/attribute
 * @returns {string} X/HTML with prefixed comments or attributes
 */
export const createTemplateString = (template, prefix) => {
	let i = 0;
	const templatePart = template
		.join('\x01')
		.trim()
		.replace(elements, (_, name, attrs, selfClosing) => {
			let ml = name + attrs.replace(attributes, '$1=$2').trimEnd();
			if (selfClosing.length) ml += empty.test(name) ? ' /' : '></' + name;
			const attributeParts = attrs
				.replace(attributes, '<!--\x02:$1-->')
				.trim()
				.replaceAll('"', '')
				.replaceAll('> <', '><');
			return `
				${attrs.includes('\x01') ? attributeParts : ''}
				<${ml}>
			`;
		})
		.replace(partPositions, (partPosition) =>
			partPosition === '\x01' ? `<!--dom-part-${i}--><!--/dom-part-${i++}-->` : `dom-part-${i++}`,
		);
	return `
		<!--template-part-->
		${templatePart}
		<!--/template-part-->
	`;
	// TODO: ^ this is actually important because of the whitespace
};

/**
 * @param {String} name
 * @param {String} quote
 * @param {any} value
 * @return {String}
 */
const attribute = (name, quote, value) => ` ${name}=${quote}${encodeAttribute(value)}${quote}`;

/**
 * @param {any} value
 * @return {String}
 */
const getValue = (value) => {
	switch (typeof value) {
		case 'string':
			return encodeAttribute(value);
		case 'boolean':
		case 'number':
			return String(value);
		case 'object':
			switch (true) {
				case Array.isArray(value):
					return value.map(getValue).join('');
				case value instanceof TemplateResult:
					return value.toString();
			}
			break;
		case 'function':
			return getValue(value());
	}
	return value == null ? '' : encodeAttribute(String(value));
};

/** @type {Map<TemplateStringsArray, *[]>} */
const parsedUpdates = new WeakMap();

/** @type {Map<Element, ChildNodePart>} */
const childNodeParts = new WeakMap();

export class TemplateResult {
	/**
	 * @param {TemplateStringsArray} strings
	 * @param {any[]} values
	 */
	constructor(strings, ...values) {
		this.strings = strings;
		this.values = values;
	}

	/**
	 * @param {Element} domNode
	 */
	renderInto(domNode) {
		let serverSideRendered = false;
		let childNodePart = childNodeParts.get(domNode);
		if (!childNodePart) {
			const startNode = Array.from(domNode.childNodes)
				.filter((node) => node.nodeType === COMMENT_NODE)
				.find((node) => node.data === 'template-part');

			serverSideRendered = startNode !== undefined;

			childNodePart = new ChildNodePart(startNode, this);
			childNodeParts.set(domNode, childNodePart);

			if (!serverSideRendered) {
				domNode.replaceChildren(...childNodePart.fragment.childNodes);
			}
		}

		// TODO; if this is expensive - performance wise - we could have a hydrate only method instead of calling renderInto for all the cases?!
		if (!serverSideRendered) {
			childNodePart.update(this);
		}
	}

	/**
	 * @param {String[]} strings
	 * @param {Number} expectedLength
	 * @return {*[]}
	 */
	parse(strings, expectedLength) {
		const html = createTemplateString(strings, prefix);
		const updates = [];
		let i = 0;
		let match = null;
		while ((match = interpolation.exec(html))) {
			const pre = html.slice(i, match.index);
			i = match.index + match[0].length;
			if (match[2]) {
				const index = match[2];
				const placeholder1 = `<!--${prefix}${index}-->`;
				const placeholder2 = `<!--/${prefix}${index}-->`;
				updates.push((value) => pre + placeholder1 + getValue(value) + placeholder2);
			} else {
				let name = '';
				let quote = match[4];
				switch (quote) {
					case '"':
					case "'":
						const next = html.indexOf(quote, i);
						name = html.slice(i, next);
						i = next + 1;
						break;
					default:
						name = html.slice(--i).replace(rename, '$1');
						i += name.length;
						quote = '"';
						break;
				}
				switch (true) {
					// case name === 'ref':
					// 	updates.push((value) => {
					// 		passRef(value);
					// 		return pre;
					// 	});
					// 	break;
					// setters as boolean attributes (.disabled .contentEditable)
					case name[0] === '?':
						const boolean = name.slice(1).toLowerCase();
						updates.push((value) => {
							let result = pre;
							if (value) result += ` ${boolean}`;
							return result;
						});
						break;
					case name[0] === '.':
						const lower = name.slice(1).toLowerCase();
						updates.push((value) => {
							let result = pre;
							// null, undefined, and false are not shown at all
							if (value != null && value !== false) {
								// true means boolean attribute, just show the name
								if (value === true) result += ` ${lower}`;
								// in all other cases, just escape it in quotes
								else result += attribute(lower, quote, value);
							}
							return result;
						});
						break;
					case name[0] === '@':
						name = 'on' + name.slice(1);
					case name[0] === 'o' && name[1] === 'n':
						updates.push((value) => {
							let result = pre;
							// allow handleEvent based objects that
							// follow the `onMethod` convention
							// allow listeners only if passed as string,
							// as functions with a special toString method,
							// as objects with handleEvents and a method
							switch (typeof value) {
								case 'object':
									if (!(name in value)) break;
									value = value[name];
									if (typeof value !== 'function') break;
								case 'function':
									if (value.toString === toString) break;
								case 'string':
									result += attribute(name, quote, value);
									break;
							}
							return result;
						});
						break;
					default:
						const placeholder = ` ${prefix}${match[4]}=${name}`;
						updates.push((value) => {
							let result = pre;
							if (value != null) {
								result += placeholder;
								result += attribute(name, quote, value);
							}
							return result;
						});
						break;
				}
			}
		}
		const { length } = updates;
		if (length !== expectedLength) throw new Error(`invalid template ${strings}`);
		if (length) {
			const last = updates[length - 1];
			const chunk = html.slice(i);
			updates[length - 1] = (value) => last(value) + chunk;
		} else updates.push(() => html);
		return updates;
	}

	/**
	 * @param {PersistentFragment} fragment
	 * @return {Part[]}
	 */
	parseParts(fragment) {
		// we always create a template fragment so that we can start at the root for traversing the node path
		// TODO: if we wanted to use real dom, we need to specify a limit/end node
		const template = globalThis.document?.createDocumentFragment();
		for (const childNode of fragment.childNodes) {
			// TODO: maybe use a range to create a fragment faster?!
			template.append(childNode.cloneNode(true));
		}

		const tw = globalThis.document?.createTreeWalker(template, 128);
		const parts = [];
		const length = this.strings.length - 1;
		let i = 0;
		let placeholder = `${prefix}${i}`;
		// search for parts through numbered placeholders
		// <div dom-part-0="attribute" dom-part-1="another-attribute"><!--dom-part-2--><span><!--dom-part-3--</span></div>
		while (i < length) {
			const node = tw.nextNode();

			// TODO: this is not a good way to handle this...
			// because the template string looks perfectly fine - it is rather not a real DocumentFragment?!
			if (!node) {
				console.log('bad template:', this, fragment);
				throw `bad template: ${this.templateString}`;
			}

			if (node.data === `${placeholder}`) {
				parts.push({ type: 'node', path: getNodePath(node) });
				// TODO: ^ could we also start parsing the stack recursively?!
				placeholder = `${prefix}${++i}`;
			} else if (node.data.includes(`${placeholder}:`)) {
				const name = node.data.split(':').pop();
				parts.push({ type: 'attribute', path: getNodePath(node), name: name });
				placeholder = `${prefix}${++i}`;
			}
			// TODO: implement... if the node is a text-only node, check its content for a placeholder
			/*if (textOnly.test(node.localName) && node.textContent.trim() === `<!--${placeholder}-->`) {
				node.textContent = '';
				// TODO: add example to test this case...
				parts.push({ type: 'text', path: getNodePath(node) });
				placeholder = `${prefix}${++i}`;
			}*/
		}
		return parts;
	}

	/**
	 * find interpolations in the given template for nodes and attributes and
	 * return a string with placeholders as either comment nodes or named attributes.
	 * @returns {string} template with tagged placeholders for values
	 */
	get templateString() {
		// TODO: this could also be cached!
		return createTemplateString(this.strings, prefix);
	}

	toString() {
		let updates = parsedUpdates.get(this.strings);

		if (!updates) {
			updates = this.parse(this.strings, this.values.length);
			parsedUpdates.set(this.strings, updates);
		}

		return this.values.length ? this.values.map((value, index) => updates[index](value)).join('') : updates[0]();
	}
}
