import { partEndMarker, partStartMarker, templateEndMarker, templateStartMarker } from './markers.js';

/**
 * Parses a template literal once into everything the renderers need. The result is cached per literal.
 *
 * - `descriptors`: one per binding in document order. A binding is an interpolation between elements (a child node
 *   part), a whole attribute with one or more interpolations, the content of a raw text element with one or more
 *   interpolations, or an interpolation at an attribute position (a directive). `index` is the index of its first
 *   value in the literal, `span` how many values it consumes, `marker` the comment marker it hangs on.
 * - `clientHtml`: the markup to clone client side, with the markers in place and the bound attributes left out.
 * - `ssrSegments`: the static markup between the bindings, one more than the descriptors, so that toString() is
 *   segments and written values alternating.
 *
 * The markup is the literal as written. The parser only follows it far enough to tell where an interpolation sits,
 * cuts the bindings out and puts the markers in. The client never reads a descriptor out of the HTML, it has the
 * literal. The markers only say where a part sits and, through the hash, whether the server rendered the same
 * literal, see markers.js.
 */

/** @typedef {{kind: 'node', index: number, marker: number}} NodeDescriptor */
/** @typedef {{kind: 'attribute', index: number, marker: number, name: string, strings: string[], span: number}} AttributeDescriptor */
/** @typedef {{kind: 'text', index: number, marker: number, tag: string, strings: string[], span: number}} TextDescriptor */
/** @typedef {{kind: 'directive', index: number, marker: number}} DirectiveDescriptor */
/** @typedef {NodeDescriptor | AttributeDescriptor | TextDescriptor | DirectiveDescriptor} Descriptor */

/**
 * @typedef {Object} ParsedTemplate
 * @property {string} hash - of the literal, the template start marker carries it
 * @property {Descriptor[]} descriptors - in document order
 * @property {string} clientHtml
 * @property {string[]} ssrSegments
 * @property {DocumentFragment} [fragment] - the parsed clientHtml, set by the client renderer on first use
 * @property {((values: any[]) => string)[]} [writers] - one per descriptor, set by toString() on first use
 */

// stands in for the interpolations while the strings are parsed as one
const MARK = '\x01';
const WHITESPACE = /[\t\n\f\r ]*/y;
const TAG_NAME = /<([a-zA-Z][^\t\n\f\r />\x01]*)/y;
// up to whitespace, `>` or `/>`, a name also up to `=`
const ATTRIBUTE_NAME = /(?:[^\t\n\f\r =>/]|\/(?!>))*/y;
const UNQUOTED_VALUE = /(?:[^\t\n\f\r >/]|\/(?!>))*/y;
const voidElements = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'source',
    'track',
    'wbr',
]);
const rawTextElements = new Set(['script', 'style', 'textarea', 'title']);

/**
 * Thrown for a literal whose interpolations sit where no part can bind them, or whose markup cannot be followed.
 */
export class ParseTemplateError extends Error {
    /**
     * @param {string} message
     * @param {object} [details] - the strings and whatever was parsed up to the error, for debugging
     */
    constructor(message, details = {}) {
        super(`element-js: ${message}`);
        this.name = 'ParseTemplateError';
        this.details = details;
    }
}

/**
 * A short hash of a literal, FNV-1a over the joined strings, base 36. The same function runs on the server and on
 * the client, the template start marker carries the result.
 * @param {TemplateStringsArray | string[]} strings
 * @return {string}
 */
export const templateHash = (strings) => {
    const source = strings.join(MARK);
    let hash = 0x811c9dc5;
    for (let position = 0; position < source.length; position++) {
        hash ^= source.charCodeAt(position);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
};

/**
 * Follows the markup of a literal far enough to tell where each interpolation sits. Copies the literal as written into
 * the client markup and the server segments, cuts the bindings out and puts the markers in.
 */
class TemplateParser {
    /** @type {TemplateStringsArray | string[]} */
    strings;

    /** @type {string} the strings joined with MARK */
    source;

    /** @type {number} */
    position = 0;

    /** @type {number} the source up to here is in the output */
    copied = 0;

    /** @type {number} the index of the next interpolation */
    index = 0;

    /** @type {Descriptor[]} */
    descriptors = [];

    /** @type {string} */
    clientHtml = '';

    /** @type {string[]} */
    ssrSegments = [''];

    /**
     * @param {TemplateStringsArray | string[]} strings
     */
    constructor(strings) {
        this.strings = strings;
        this.source = strings.join(MARK);
    }

    /**
     * @return {ParsedTemplate}
     */
    parse() {
        const { source, strings } = this;
        const hash = templateHash(strings);
        this.append(templateStartMarker(hash));
        while (this.position < source.length) {
            const char = source[this.position];
            if (char === MARK) {
                this.parseChildNode();
            } else if (char === '<') {
                this.parseMarkup();
            } else {
                this.position++;
            }
        }
        this.copyTo(source.length);
        this.append(templateEndMarker);

        const consumed = this.descriptors.reduce((sum, descriptor) => sum + (descriptor.span ?? 1), 0);
        if (consumed !== strings.length - 1) {
            this.fail(`${strings.length - 1} interpolations in the template, ${consumed} of them could be bound`);
        }
        return { hash, descriptors: this.descriptors, clientHtml: this.clientHtml, ssrSegments: this.ssrSegments };
    }

    /**
     * An interpolation between elements. The client markup gets both part markers, the server segments end between
     * them.
     */
    parseChildNode() {
        const { index, position } = this;
        this.copyTo(position);
        this.append(partStartMarker(index));
        this.clientHtml += partEndMarker(index);
        this.cut({ kind: 'node', index, marker: index }, position + 1);
        this.ssrSegments[this.ssrSegments.length - 1] += partEndMarker(index);
        this.index++;
        this.position++;
    }

    /**
     * A comment, a start tag or an end tag at the position. Comments and end tags are skipped, they are copied as
     * they are. A `<` that starts none of them is text.
     */
    parseMarkup() {
        const { source, position } = this;
        if (source.startsWith('<!--', position)) {
            const end = source.indexOf('-->', position + 4);
            if (end === -1) this.fail('a comment is not closed');
            if (source.slice(position, end).includes(MARK)) {
                this.fail('an interpolation inside a comment is not supported');
            }
            this.position = end + 3;
            return;
        }
        if (source[position + 1] === MARK) this.fail('an interpolation as a tag name is not supported');
        const tag = this.match(TAG_NAME);
        if (tag) {
            this.parseElement(tag[1], position);
        } else if (source[position + 1] === '/') {
            const end = source.indexOf('>', position);
            if (end === -1) this.fail('an end tag is not closed');
            if (source.slice(position, end).includes(MARK)) {
                this.fail('an interpolation inside an end tag is not supported');
            }
            this.position = end + 1;
        } else {
            this.position++;
        }
    }

    /**
     * An element, the position behind its tag name: the attributes of the start tag and the content of a raw text
     * element. Writes the start tag with the marker in front and without its bound attributes.
     * @param {string} tag
     * @param {number} tagStart - the position of the <
     */
    parseElement(tag, tagStart) {
        const lowerTag = tag.toLowerCase();
        /** @type {{from: number, to: number, descriptor: Descriptor}[]} the bindings with the source they take */
        const bindings = [];
        let marker = -1; // the index of the first binding of the element
        let tokenEnd; // the end of the tag name or of the last attribute, before the whitespace after it
        let selfClosing = false;
        for (;;) {
            tokenEnd = this.position;
            this.match(WHITESPACE);
            const char = this.source[this.position];
            if (char === undefined) this.fail(`the start tag <${tag}> is not closed`);
            if (char === '>' || this.source.startsWith('/>', this.position)) {
                selfClosing = char === '/';
                this.position += selfClosing ? 2 : 1;
                break;
            }
            if (char === '/') {
                this.position++;
                continue;
            }
            const descriptor = this.parseAttribute(tag);
            if (!descriptor) continue;
            if (marker === -1) marker = this.index;
            bindings.push({
                from: tokenEnd,
                to: this.position,
                descriptor: { ...descriptor, index: this.index, marker },
            });
            this.index += descriptor.span ?? 1;
        }
        const tagEnd = this.position;

        let text;
        if (rawTextElements.has(lowerTag) && !selfClosing) {
            const { strings, end } = this.parseRawText(tag, lowerTag);
            const span = strings.length - 1;
            if (span > 0) {
                if (marker === -1) marker = this.index;
                text = { end, descriptor: { kind: 'text', index: this.index, marker, tag: lowerTag, strings, span } };
                this.index += span;
            }
        }

        this.copyTo(tagStart);
        if (marker !== -1) this.append(partStartMarker(marker));
        for (const { from, to, descriptor } of bindings) {
            this.copyTo(from);
            this.cut(descriptor, to);
        }
        // the tag is closed without the whitespace in front of the bracket. The browser does not close an element on
        // "/>", the end tag is written for it
        this.copyTo(tokenEnd);
        this.copied = tagEnd;
        if (!selfClosing) {
            this.append('>');
        } else {
            this.append(voidElements.has(lowerTag) ? ' />' : `></${tag}>`);
        }
        if (text) {
            this.clientHtml += text.descriptor.strings.join('');
            this.cut(text.descriptor, text.end);
        }
    }

    /**
     * An attribute of a start tag, or an interpolation at an attribute position, which is a directive.
     * @param {string} tag
     * @return {{kind: string, name?: string, strings?: string[], span?: number} | undefined} the binding, undefined
     * for a static attribute
     */
    parseAttribute(tag) {
        const { source } = this;
        if (source[this.position] === MARK) {
            this.position++;
            return { kind: 'directive' };
        }
        const name = this.match(ATTRIBUTE_NAME)[0];
        if (name.includes(MARK)) {
            this.fail(
                `an interpolation in the attribute name "${name.replaceAll(
                    MARK,
                    '${…}',
                )}" of <${tag}> is not supported`,
            );
        }
        const nameEnd = this.position;
        this.match(WHITESPACE);
        if (source[this.position] !== '=') {
            this.position = nameEnd;
            return undefined;
        }
        this.position++;
        this.match(WHITESPACE);
        let value;
        const quote = source[this.position];
        if (quote === '"' || quote === "'") {
            const end = source.indexOf(quote, this.position + 1);
            if (end === -1) this.fail(`the value of the attribute "${name}" of <${tag}> is not closed`);
            value = source.slice(this.position + 1, end);
            this.position = end + 1;
        } else {
            value = this.match(UNQUOTED_VALUE)[0];
        }
        if (!value.includes(MARK)) return undefined;
        const strings = value.split(MARK);
        const span = strings.length - 1;
        if ('?.@'.includes(name[0]) && (span > 1 || strings[0] !== '' || strings[1] !== '')) {
            this.fail(
                `the value of "${name}" on <${tag}> has to be a single interpolation, a boolean, property or event binding takes the whole value`,
            );
        }
        return { kind: 'attribute', name, strings, span };
    }

    /**
     * The content of a raw text element: text up to its end tag, whatever it looks like. An end tag may carry
     * whitespace before its bracket, a formatter writes </style\n> when it wraps a line. The position moves behind
     * the end tag.
     * @param {string} tag
     * @param {string} lowerTag
     * @return {{strings: string[], end: number}} the static pieces of the content and the position of the end tag
     */
    parseRawText(tag, lowerTag) {
        const endTag = new RegExp(`</${lowerTag}[\\t\\n\\f\\r ]*>`, 'ig');
        endTag.lastIndex = this.position;
        const match = endTag.exec(this.source);
        if (!match) this.fail(`the element <${tag}> has no end tag`);
        const strings = this.source.slice(this.position, match.index).split(MARK);
        this.position = endTag.lastIndex;
        return { strings, end: match.index };
    }

    /**
     * Matches a sticky pattern at the position and moves behind the match.
     * @param {RegExp} pattern
     * @return {RegExpExecArray | null}
     */
    match(pattern) {
        pattern.lastIndex = this.position;
        const match = pattern.exec(this.source);
        if (match) this.position = pattern.lastIndex;
        return match;
    }

    /**
     * Appends markup to the client markup and to the current server segment.
     * @param {string} markup
     */
    append(markup) {
        this.clientHtml += markup;
        this.ssrSegments[this.ssrSegments.length - 1] += markup;
    }

    /**
     * Copies the source up to a position into the output, as written.
     * @param {number} to
     */
    copyTo(to) {
        this.append(this.source.slice(this.copied, to));
        this.copied = to;
    }

    /**
     * Ends the server segment at a binding. The source up to the position is the binding, it stays out of the output.
     * @param {Descriptor} descriptor
     * @param {number} to
     */
    cut(descriptor, to) {
        this.descriptors.push(descriptor);
        this.ssrSegments.push('');
        this.copied = to;
    }

    /**
     * @param {string} message
     */
    fail(message) {
        throw new ParseTemplateError(message, {
            source: this.source.replaceAll(MARK, '${…}'),
            position: this.position,
            descriptors: this.descriptors,
        });
    }
}

/** @type {WeakMap<TemplateStringsArray, ParsedTemplate>} */
const cache = new WeakMap();

/**
 * The parsed form of a template literal, computed once per literal.
 * @param {TemplateStringsArray} strings
 * @return {ParsedTemplate}
 */
export const parseTemplate = (strings) => {
    let parsed = cache.get(strings);
    if (!parsed) {
        parsed = new TemplateParser(strings).parse();
        cache.set(strings, parsed);
    }
    return parsed;
};
