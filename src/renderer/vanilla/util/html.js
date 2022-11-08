import { camelToDash, decodeAttribute, encodeAttribute } from '../../../util/AttributeParser';
import { TemplatePart } from './render';

// TODO: this is the same as in render.js
const prefix = 'dom-part-';
const empty = /^(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)$/i;
const elements = /<([a-z]+[a-z0-9:._-]*)([^>]*?)(\/?)>/g;
const attributes = /([^\s\\>"'=]+)\s*=\s*(['"]?)\x01/g;
// TODO: find a better name for holes...
const holes = /[\x01\x02]/g;

// \x01 Node.ELEMENT_NODE
// \x02 Node.ATTRIBUTE_NODE

/**
 * Given a template, find holes as both nodes and attributes and
 * return a string with holes as either comment nodes or named attributes.
 * @param {string[]} template a template literal tag array
 * @param {string} prefix prefix to use per each comment/attribute
 * @param {boolean} svg enforces self-closing tags
 * @returns {string} X/HTML with prefixed comments or attributes
 */
const createTemplateString = (template, prefix) => {
	let i = 0;
	return template
		.join('\x01')
		.trim()
		.replace(elements, (_, name, attrs, selfClosing) => {
			let ml = name + attrs.replace(attributes, '\x02=$2$1').trimEnd();
			if (selfClosing.length) ml += empty.test(name) ? ' /' : '></' + name;
			return '<' + ml + '>';
		})
		.replace(holes, (hole) =>
			hole === '\x01' ? '<!--' + prefix + i + '--><!--/' + prefix + i++ + '-->' : prefix + i++,
		);
};

// TODO: this is new:
const rename = /([^\s>]+)[\s\S]*$/;
const interpolation = new RegExp(`(<!--${prefix}(\\d+)--><!--/${prefix}(\\d+)-->|\\s*${prefix}(\\d+)=([^\\s>]))`, 'g');

const attribute = (name, quote, value) => ` ${name}=${quote}${encodeAttribute(value)}${quote}`;

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

// TODO: these are not templates?! But rather Updates?! I'm not sure uf updates is the right term either...
const parsedTemplates = new WeakMap();

const templateParts = new WeakMap();

export class TemplateResult {
	constructor(strings, ...values) {
		this.strings = strings;
		this.values = values;
	}

	renderInto(domNode) {
		let templatePart = templateParts.get(domNode);
		if (!templatePart) {
			// TODO: this does not have a name yet...
			// just a pojo { childNodes: [] }
			templatePart = new TemplatePart(
				this,
				domNode.childNodes.length > 0 ? { childNodes: domNode.childNodes } : undefined,
			);
			templateParts.set(domNode, templatePart);

			// TODO: maybe we could have a root marker and look for that?!
			if (domNode.childNodes.length === 0) {
				domNode.replaceChildren(...templatePart.fragment.childNodes);
			}
		}

		templatePart.update(this);
	}

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
	 * find interpolations in the given template for nodes and attributes and
	 * return a string with placeholders as either comment nodes or named attributes.
	 * @param {string[]} strings a template literal tag array
	 * @param {string} prefix prefix to use per each comment/attribute
	 * @returns {string} template with tagged placeholders for values
	 */
	get templateString() {
		// TODO: this could also be cached!
		return createTemplateString(this.strings, prefix);
	}

	toString() {
		let updates = parsedTemplates.get(this.strings);

		if (!updates) {
			updates = this.parse(this.strings, this.values.length);
			parsedTemplates.set(this.strings, updates);
		}

		return this.values.length ? this.values.map(update, updates).join('') : updates[0]();
	}
}

// TODO: WTF?!
function update(value, i) {
	return this[i](value);
}

const html = function (strings, ...values) {
	return new TemplateResult(strings, ...values);
};

const unsafeHTML = (string) => {
	return () => `${decodeAttribute(string)}`;
};

const spreadAttributes = (attributes) => {
	return () => {
		return Object.keys(attributes)
			.map((key) => {
				let value = attributes[key];
				return `${camelToDash(key)}='${encodeAttribute(
					typeof value !== 'string' ? JSON.stringify(value) : value,
				)}'`;
			})
			.join(' ');
	};
};

export { html, unsafeHTML, spreadAttributes };
