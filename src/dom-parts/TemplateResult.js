import { COMMENT_NODE, getNodePath } from '../util/DOMHelper';
import { encodeAttribute, isObjectLike } from '../util/AttributeParser.js';
import { TemplatePart } from './TemplatePart.js';

const voidElements = /^(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;
const elements = /<([a-z]+[a-z0-9:._-]*)([^>]*?)(\/?)>/g;
// TODO: v this will not match any values with escaped quotes like onClick='console.log("\'test")'
const attributes = /([^\s]*)=((?:")[^"]*(?:")|(?:')[^']*(?:')|[^\s\/>]*)|([^\s\/>]*)/g;
const partPositions = /[\x01\x02]/g;
// \x01 Node.ELEMENT_NODE
// \x02 Node.ATTRIBUTE_NODE
// \x03 COMMENT.ATTRIBUTE_TOKEN
// \x04 Node.ATTRIBUTE_TOKEN

const interpolation = new RegExp(`(<!--dom-part-(\\d+)--><!--/dom-part-(\\d+)-->|(\\S\\w+)="\x04(")?|\x04)`, 'g');

/**
 * Given a template, find part positions as both nodes and attributes and
 * return a string with placeholders as either comment nodes or named attributes.
 * @param {TemplateStringsArray | string[]} templateStrings a template literal tag array
 * @param {string} attributePlaceholders replace placeholders inside attribute values with this value
 * @returns {string} X/HTML with prefixed comments or attributes
 */
export const createTemplateString = (templateStrings, attributePlaceholders = '') => {
	// TODO: make it easier to identify attribute and node parts for SSR and leave the comments at those positions to be replaced in toString()
	let partIndex = 0;
	// join all interpolations (for values) with a special placeholder and remove any whitespace
	let template = templateStrings.join('\x01').trim();
	// find (match) all elements to identify their attributes
	template = template.replace(elements, (_, name, attributesString, trailingSlash) => {
		let elementTagWithAttributes = name + attributesString.replaceAll('\x01', attributePlaceholders).trimEnd();
		if (trailingSlash.length) elementTagWithAttributes += voidElements.test(name) ? ' /' : '></' + name;
		// collect all attribute parts so that we can place matching comment nodes
		const attributeParts = attributesString.replace(attributes, (attribute, name, valueWithQuotes, directive) => {
			if (directive) {
				return `<!--\x02$-->`;
			}

			// remove quotes from attribute value to normalize the value
			const value =
				valueWithQuotes?.startsWith('"') || valueWithQuotes?.startsWith("'")
					? valueWithQuotes.slice(1, -1)
					: valueWithQuotes;
			const partsCount = (attribute.match(/\x01/g) || []).length;
			const parts = [];
			for (let index = 0; index < partsCount; index++) {
				parts.push(`<!--\x02:${name}=${value.replaceAll('\x01', '\x03')}-->`);
			}
			return parts.join('');
		});
		return `
				${attributesString.includes('\x01') ? attributeParts : ''}
				<${elementTagWithAttributes}>
			`;
	});
	// replace interpolation placeholders with our indexed markers
	template = template.replace(partPositions, (partPosition) => {
		if (partPosition === '\x01') {
			return `<!--dom-part-${partIndex}--><!--/dom-part-${partIndex++}-->`;
		}
		if (partPosition === '\x02') {
			return `dom-part-${partIndex++}`;
		}
	});
	return `
		<!--template-part-->
		${template}
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
const attribute = (name, value, isSingleValue = true) => {
	return ` ${name}="${encodeAttribute(isObjectLike(value) ? JSON.stringify(value) : value)}${
		isSingleValue ? '"' : ''
	}`;
};

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

/** @type {Map<Element, TemplatePart>} */
const templateParts = new WeakMap();

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
		let templatePart = templateParts.get(domNode);
		if (!templatePart) {
			const startNode = Array.from(domNode.childNodes)
				.filter((node) => node.nodeType === COMMENT_NODE)
				.find((node) => node.data === 'template-part');

			serverSideRendered = startNode !== undefined;

			templatePart = new TemplatePart(startNode, this);
			templateParts.set(domNode, templatePart);

			if (!serverSideRendered) {
				domNode.replaceChildren(...templatePart.childNodes);
			}
		} else {
			templatePart.update(this);
		}
	}

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
				// AttributePart in the middle of an attribute value or NodePart
				parts.push((value) => {
					let result = pre;
					// TODO: we currently cannot distinguish between NodeParts and AttributeParts before
					if (isObjectLike(value) && value.directiveClass) {
						// NodePart
						const directive = new value.directiveClass();
						result += directive.stringify(...value.values);
					} else if (value != null) {
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
		const range = globalThis.document?.createRange();
		range.setStartBefore(childNodes[0]);
		range.setEndAfter(childNodes[childNodes.length - 1]);
		const template = range.cloneContents();

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
				if (/^dom-part-\d+\$/.test(node.data)) {
					currentPart = undefined;
					parts.push({ type: 'directive', path: getNodePath(node) });
				}
			}
			return parts;
		};

		const parts = getParts();

		// We couldn't correctly parse parts from the template
		if (parts.length !== this.strings.length - 1) {
			throw {
				name: 'ParseTemplateError',
				message:
					'Could not parse parts from template correctly. Parts length has not the expected length. -> ' +
					JSON.stringify({
						strings: this.strings,
						templateString: this.templateString,
						childNodes,
						template,
						parts,
					}),
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
