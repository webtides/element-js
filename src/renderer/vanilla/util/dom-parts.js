import { encodeAttribute } from '../../../util/AttributeParser';
import { processPart } from './dom-processers';
import {
	COMMENT_NODE,
	convertStringToTemplate,
	getNodePath,
	PERSISTENT_DOCUMENT_FRAGMENT_NODE,
} from '../../../util/DOMHelper';

// the prefix is used to tag and reference nodes and attributes to create parts with updates
// attributes: dom-part-1="attribute-name"
// nodes|fragments|arrays (as comment nodes): <!--dom-part-2-->
const prefix = 'dom-part-';

// match nodes|elements that cannot contain comment nodes and must be handled via text-only updates directly.
const textOnly = /^(?:textarea|script|style|title|plaintext|xmp)$/;

const empty = /^(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)$/i;
const elements = /<([a-z]+[a-z0-9:._-]*)([^>]*?)(\/?)>/g;
const attributes = /([^\s\\>"'=]+)\s*=\s*(['"]?)\x01/g;
const partPositions = /[\x01\x02]/g;
// \x01 Node.ELEMENT_NODE
// \x02 Node.ATTRIBUTE_NODE

const rename = /([^\s>]+)[\s\S]*$/;
const interpolation = new RegExp(`(<!--${prefix}(\\d+)--><!--/${prefix}(\\d+)-->|\\s*${prefix}(\\d+)=([^\\s>]))`, 'g');

/**
 * Given a template, find part positions as both nodes and attributes and
 * return a string with placeholders as either comment nodes or named attributes.
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
		.replace(partPositions, (partPosition) =>
			partPosition === '\x01' ? '<!--' + prefix + i + '--><!--/' + prefix + i++ + '-->' : prefix + i++,
		);
};

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

const parsedUpdates = new WeakMap();
const childNodeParts = new WeakMap();

export class TemplateResult {
	constructor(strings, ...values) {
		this.strings = strings;
		this.values = values;
	}

	renderInto(domNode) {
		let serverSideRendered = false;
		let childNodePart = childNodeParts.get(domNode);
		if (!childNodePart) {
			// TODO: find a better way to get the comment node here...
			serverSideRendered = domNode.innerHTML.trim().startsWith('<!--template-result-->');
			childNodePart = new ChildNodePart(
				undefined, // TODO
				this,
				domNode.childNodes.length > 0 ? new PersistentFragment(domNode) : undefined,
			);
			childNodeParts.set(domNode, childNodePart);

			// TODO: maybe we could have a root marker and look for that?!
			if (domNode.childNodes.length === 0) {
				domNode.replaceChildren(...childNodePart.fragment.childNodes);
			}
		}

		// TODO; if this is expensive - performance wise - we could have a hydrate only method instead of calling renderInto for all the cases?!
		if (!serverSideRendered) {
			childNodePart.update(this);
		}
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
		let updates = parsedUpdates.get(this.strings);

		if (!updates) {
			updates = this.parse(this.strings, this.values.length);
			parsedUpdates.set(this.strings, updates);
		}

		return this.values.length ? this.values.map((value, index) => updates[index](value)).join('') : updates[0]();
	}
}

const partsCache = new WeakMap();
const fragmentsCache = new WeakMap();

export class Part {
	node = undefined;
	value = undefined;
	processor = undefined;

	constructor(node, value) {
		this.node = node;
		this.value = value;
	}

	update(newValue, oldValue) {
		if (this.node) {
			return this.processor?.(newValue, oldValue);
		}
	}
}

export class AttributePart extends Part {
	name = undefined;

	// TODO: this is the actual node
	constructor(node, name) {
		super(node);
		this.name = name;
		this.processor = processPart(this);
	}
}

export class ChildNodePart extends Part {
	// Used to remember parent template state as we recurse into nested templates
	parts = [];
	strings = undefined;

	fragment = undefined; // PersistentFragment
	values = undefined;

	// commentNode, TemplateResult | array, PersistentFragment
	constructor(node, value, fragment) {
		super(node, value);
		this.fragment = fragment;
		this.value = this.parseValue(value);
		if (node) this.processor = processPart(this);
	}

	parseValue(value) {
		if (Array.isArray(value)) {
			return this.parseArray(value);
		}
		if (value instanceof TemplateResult) {
			this.parseTemplateResult(value);
			return this.fragment;
		}
		return value;
	}

	update(value) {
		if (value instanceof TemplateResult || Array.isArray(value)) {
			const parsedValue = this.parseValue(value);
			const parsedOldValue = this.value;
			this.value = parsedValue;

			const values = Array.isArray(value) ? value : value.values;

			for (let index = 0; index < values.length; index++) {
				// TODO: parts and values might have different lengths?!
				this.parts[index].update(values[index]);
			}

			// TODO: is this really doing the right thing?!
			return super.update(parsedValue, parsedOldValue);
		} else {
			return super.update(value);
		}
	}

	// nested TemplateResults values need to be unrolled in order for update functions to be able to process them
	parseArray(values) {
		const parsedValues = [];
		for (let index = 0; index < values.length; index++) {
			let value = values[index];
			const node = this.fragment?.childNodes?.[index];

			if (value instanceof TemplateResult || Array.isArray(value)) {
				let childNodePart = this.parts[index];
				if (!childNodePart) {
					childNodePart = new ChildNodePart(
						undefined, // TODO
						value,
						node ? new PersistentFragment([node]) : undefined,
					);
					this.parts[index] = childNodePart;
				} else {
					childNodePart.parseValue(value);
				}

				parsedValues[index] = childNodePart.valueOf();
			} else {
				parsedValues[index] = value;
			}
		}

		return parsedValues;
	}

	parseTemplateResult(templateResult) {
		if (this.strings !== templateResult.strings) {
			if (!this.fragment) {
				let fragment = fragmentsCache.get(templateResult.strings);
				if (!fragment) {
					fragment = this.parseFragment(templateResult);
					fragmentsCache.set(templateResult.strings, fragment);
				}
				this.fragment = new PersistentFragment(fragment);
			}

			// TODO: maybe we can move this into TemplateResult?!
			// But then it would run on the server... :(
			// Maybe we can move it there, but not run it on creation but only when requested...
			// But then we would still have to shim things like TreeWalker and DocumentFragment right?!
			let parts = partsCache.get(templateResult.strings);
			if (!parts) {
				parts = this.parseParts(templateResult, this.fragment);
				partsCache.set(templateResult.strings, parts);
			}

			this.parts = parts.map((part, index) => {
				// We currently need the path because the fragment will be cloned via importNode and therefore the node will be a different one
				const node = part.path.reduceRight(({ childNodes }, i) => childNodes[i], this.fragment);

				if (part.type === 'node') {
					const placeholder = node.data;

					const childNodes = [];
					let childNode = node.nextSibling;
					while (childNode && childNode.data !== `/${placeholder}`) {
						childNodes.push(childNode);
						childNode = childNode.nextSibling;
					}

					const endCommentMarker = childNode?.data === `/${placeholder}` ? childNode : node;

					const fragment = new PersistentFragment(childNodes);
					return new ChildNodePart(endCommentMarker, templateResult.values[index], fragment);
				}
				if (part.type === 'attribute') {
					return new AttributePart(node, part.name);
				}
				if (part.type === 'text') {
					return new TextOnlyNodePart(node, templateResult.values[index]);
				}

				throw `cannot map part: ${part}`;
			});
			this.strings = templateResult.strings;
		}
	}

	parseFragment(templateResult) {
		const templateString = templateResult.templateString;
		return convertStringToTemplate(templateString);
	}

	// PersistentFragment
	parseParts(templateResult, fragment) {
		// we always create a template fragment so that we can start at the root for traversing the node path
		// TODO: for real dom we need to specify a limit/end node
		const template = globalThis.document?.createDocumentFragment();
		for (const childNode of fragment.childNodes) {
			// TODO: maybe use a range to create a fragment faster?!
			template.append(childNode.cloneNode(true));
		}

		const tw = globalThis.document?.createTreeWalker(template, 1 | 128);
		const parts = [];
		const length = templateResult.strings.length - 1;
		let i = 0;
		let placeholder = `${prefix}${i}`;
		// search for parts through numbered placeholders
		// <div dom-part-0="attribute" dom-part-1="another-attribute"><!--dom-part-2--><span><!--dom-part-3--</span></div>
		while (i < length) {
			const node = tw.nextNode();

			// TODO: this is not a good way to handle this...
			// because the template string looks perfectly fine - it is rather not a real DocumentFragment?!
			if (!node) {
				console.log('bad template:', templateResult, fragment);
				throw `bad template: ${templateResult.templateString}`;
			}

			if (node.nodeType === COMMENT_NODE) {
				if (node.data === `${placeholder}`) {
					// TODO: do we need markers for parts inside arrays ?! (like lit)
					// https://lit.dev/playground/#sample=examples/repeating-and-conditional

					// therefore we probably need a comment/marker node around the template right?!
					parts.push({ type: 'node', path: getNodePath(node) });
					// TODO: ^ could we also start parsing the stack recursively?!
					placeholder = `${prefix}${++i}`;
				}
			} else {
				while (node.hasAttribute(placeholder)) {
					parts.push({ type: 'attribute', path: getNodePath(node), name: node.getAttribute(placeholder) });
					// the placeholder attribute can be removed once we have our part for processing updates
					//node.removeAttribute(placeholder);
					placeholder = `${prefix}${++i}`;
				}
				// if the node is a text-only node, check its content for a placeholder
				if (textOnly.test(node.localName) && node.textContent.trim() === `<!--${placeholder}-->`) {
					node.textContent = '';
					// TODO: add example to test this case...
					parts.push({ type: 'text', path: getNodePath(node) });
					placeholder = `${prefix}${++i}`;
				}
			}
		}
		return parts;
	}

	valueOf() {
		// TemplateResult | Array
		return this.values ? this.values : this.fragment;
	}
}

export class TextOnlyNodePart extends Part {
	constructor(node, value) {
		super(node, value);
		this.processor = processPart(this);
	}
}

// https://github.com/whatwg/dom/issues/736
/**
 * Keeps the references of child nodes after they have been added/inserted into a real document
 * other than a "normal" Fragment that will be empty after such operations
 */
export class PersistentFragment {
	// TODO: I think we can get rid of this ^ if we simply store childNodes[] on ChildNodePart
	childNodes = [];

	constructor(node) {
		if (node instanceof DocumentFragment) {
			const fragment = globalThis.document?.importNode(node, true);
			this.childNodes = [...fragment.childNodes];
		} else if (Array.isArray(node)) {
			this.childNodes = [...node];
		} else {
			this.childNodes = [...node.childNodes];
		}
	}

	get ELEMENT_NODE() {
		return ELEMENT_NODE;
	}

	get nodeType() {
		return PERSISTENT_DOCUMENT_FRAGMENT_NODE;
	}

	get firstChild() {
		return this.childNodes[0];
	}

	get lastChild() {
		return this.childNodes[this.childNodes.length - 1];
	}
}
