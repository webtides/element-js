import { COMMENT_NODE, getNodePath } from '../../../util/DOMHelper';
import { encodeAttribute, isObjectLike } from '../../../util/AttributeParser.js';
import { ChildNodePart } from './ChildNodePart.js';

// the prefix is used to tag and reference nodes and attributes to create parts with updates
// attributes: dom-part-1="attribute-name"
// nodes|fragments|arrays (as comment nodes): <!--dom-part-2--><!--/dom-part-2-->
export const prefix = 'dom-part-';

const empty = /^(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)$/i;
const elements = /<([a-z]+[a-z0-9:._-]*)([^>]*?)(\/?)>/g;
const attributes = /([^\s\\>"'=]+)=(['"]?([^"]*)['"]?)/g;
// const attributes = /([^\s\\>"'=]+)=(['"]?)(.*?)\2(?=\s|\/?>)/g;
// TODO: ^ this should work but does not..
// But if found something interesting...
/*
` class="foo bar baz" foo="bar" bar='baz' baz=blup`.match(/([^\s\\>"'=]+)=(['"]?)(.*?)\2(?=\s|\/?>)/g)
Array(3) [ 'class="foo bar baz"', 'foo="bar"', "bar='baz'" ]

` foo="bar" bar='baz' baz=blup class="foo bar baz"`.match(/([^\s\\>"'=]+)=(['"]?)(.*?)\2(?=\s|\/?>)/g)
Array(4) [ 'foo="bar"', "bar='baz'", "baz=blup", 'class="foo' ]
 */
// Both are actually wrong... but why would it matter where I place the class attribute (beginning or end) ?!
const partPositions = /[\x01\x02]/g;
// \x01 Node.ELEMENT_NODE
// \x02 Node.ATTRIBUTE_NODE
// \x03 COMMENT.ATTRIBUTE_TOKEN
// \x04 Node.ATTRIBUTE_TOKEN

const interpolation = new RegExp(`(<!--dom-part-(\\d+)--><!--/dom-part-(\\d+)-->|(\\S\\w+)="\x04(")?|\x04)`, 'g');

/**
 * Given a template, find part positions as both nodes and attributes and
 * return a string with placeholders as either comment nodes or named attributes.
 * @param {string[]} template a template literal tag array
 * @param {string} attributePlaceholders replace placeholders inside attribute values with this value
 * @returns {string} X/HTML with prefixed comments or attributes
 */
export const createTemplateString = (template, attributePlaceholders = '') => {
	let i = 0;
	const templatePart = template
		.join('\x01')
		.trim()
		.replace(elements, (_, name, attrs, selfClosing) => {
			let ml = name + attrs.replaceAll('\x01', attributePlaceholders).trimEnd();
			if (selfClosing.length) ml += empty.test(name) ? ' /' : '></' + name;
			const attributeParts = attrs.replace(attributes, (attribute, name, valueWithQuotes, value) => {
				const count = (attribute.match(/\x01/g) || []).length;
				const parts = [];
				for (let j = 0; j < count; j++) {
					parts.push(`<!--\x02:${name}=${value.replaceAll('\x01', '\x03')}-->`);
				}
				return parts.join('');
			});
			return `
				${attrs.includes('\x01') ? attributeParts : ''}
				<${ml}>
			`;
		})
		.replace(partPositions, (partPosition) => {
			if (partPosition === '\x01') {
				return `<!--dom-part-${i}--><!--/dom-part-${i++}-->`;
			}
			if (partPosition === '\x02') {
				return `dom-part-${i++}`;
			}
		});
	return `
		<!--template-part-->
		${templatePart}
		<!--/template-part-->
	`;
	// TODO: ^ this is actually important because of the whitespace
};

/**
 * @param {String} name
 * @param {any} value
 * @param {Boolean} isSingleValue
 * @return {String}
 */
const attribute = (name, value, isSingleValue = true) =>
	` ${name}="${encodeAttribute(isObjectLike(value) ? JSON.stringify(value) : value)}${isSingleValue ? '"' : ''}`;

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
				domNode.replaceChildren(...childNodePart.childNodes);
			}
		} else {
			childNodePart.update(this);
		}
	}

	// TODO: think about if we could use this for both SSR and CSR ?!
	// but in CSR we actually need the dom nodes to know where to make the updates
	// but maybe instead of "duplicate" update functions, we could somehow use the same update function that the parts are using?
	/**
	 * @param {String[]} strings
	 * @return {(() => String)[]}
	 */
	parse(strings) {
		const html = createTemplateString(strings, '\x04');
		const parts = [];
		let i = 0;
		let match = null;
		while ((match = interpolation.exec(html))) {
			const pre = html.slice(i, match.index);
			i = match.index + match[0].length;
			if (match[2]) {
				// ChildNodePart
				const index = match[2];
				parts.push((value) => `${pre}<!--dom-part-${index}-->${getValue(value)}<!--/dom-part-${index}-->`);
			} else if (match[4]) {
				// AttributePart with single interpolation or the first interpolation right after the attribute=
				const isSingleValue = match[5] !== undefined;
				let name = match[4];
				switch (true) {
					case name[0] === '?':
						const booleanName = name.slice(1).toLowerCase();
						parts.push((value) => {
							if (!value) return '';
							return `${pre} ${booleanName}=""`;
						});
						break;
					case name[0] === '.':
						const lower = name.slice(1).toLowerCase();
						parts.push((value) => {
							let result = pre;
							// null, undefined, and false are not shown at all
							if (value === null || value === undefined || value === '') {
								result += attribute(lower, '');
							} else {
								// in all other cases, just escape it in quotes
								result += attribute(lower, value, isSingleValue);
							}
							return result;
						});
						break;
					case name[0] === '@':
						name = 'on' + name.slice(1);
					case name[0] === 'o' && name[1] === 'n':
						parts.push((value) => {
							return pre;
						});
						break;
					default:
						parts.push((value) => {
							let result = pre;
							if (value != null) {
								result += attribute(name, value, isSingleValue);
							}
							return result;
						});
						break;
				}
			} else {
				// AttributePart in the middle of an attribute value
				parts.push((value) => {
					let result = pre;
					if (value != null) {
						result += encodeAttribute(isObjectLike(value) ? JSON.stringify(value) : value);
					}
					return result;
				});
			}
		}

		// We couldn't correctly parse parts from the template
		if (parts.length !== strings.length - 1) {
			throw {
				name: 'ParseTemplateError',
				message: 'Could not parse parts from template correctly. Parts length has not the expected length.',
				strings,
				templateString: html,
				parts,
			};
		}

		if (parts.length) {
			const last = parts[parts.length - 1];
			const chunk = html.slice(i);
			parts[parts.length - 1] = (value) => last(value) + chunk;
		} else {
			parts.push(() => html);
		}
		return parts;
	}

	/**
	 * @param {Node[]} childNodes
	 * @return {object[]}
	 */
	parseParts(childNodes) {
		// we always create a template fragment so that we can start at the root for traversing the node path
		// TODO: if we wanted to use real dom, we need to specify a limit/end node
		const template = globalThis.document?.createDocumentFragment();
		for (const childNode of childNodes) {
			// TODO: maybe use a range to create a fragment faster?!
			template.append(childNode.cloneNode(true));
		}

		const treeWalker = globalThis.document?.createTreeWalker(template, 128);
		let node = treeWalker.currentNode;

		// this is kinda freaky because the tree walker is shared throughout the recursion - but YOLO
		const getParts = () => {
			const parts = [];
			let currentPart = undefined;
			// search for parts through numbered comment nodes with placeholders
			while ((node = treeWalker.nextNode())) {
				if (/^template-part$/.test(node.data) && currentPart) {
					// start recursion -> add nested parts to previous part
					currentPart.parts = getParts();
				}
				if (/^\/template-part$/.test(node.data)) {
					// end recursion
					return parts;
				}
				if (/^dom-part-\d+$/.test(node.data)) {
					parts.push((currentPart = { type: 'node', path: getNodePath(node), parts: [] }));
				}
				if (/^dom-part-\d+:/.test(node.data)) {
					const [_, attribute] = node.data.split(':');
					const [name, initialValue] = attribute.split('=');
					currentPart = undefined;
					parts.push({ type: 'attribute', path: getNodePath(node), name: name, initialValue });
				}
			}
			return parts;
		};

		const parts = getParts();

		// We couldn't correctly parse parts from the template
		if (parts.length !== this.strings.length - 1) {
			throw {
				name: 'ParseTemplateError',
				message: 'Could not parse parts from template correctly. Parts length has not the expected length.',
				strings: this.strings,
				templateString: this.templateString,
				fragment,
				template,
				parts,
			};
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
		return createTemplateString(this.strings);
	}

	toString() {
		let updates = parsedUpdates.get(this.strings);

		if (!updates) {
			updates = this.parse(this.strings);
			parsedUpdates.set(this.strings, updates);
		}

		return this.values.length ? this.values.map((value, index) => updates[index](value)).join('') : updates[0]();
	}
}
