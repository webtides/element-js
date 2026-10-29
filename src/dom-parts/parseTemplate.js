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
const WHITESPACE = /[\t\n\f\r ]/;
const TAG_NAME = /<([a-zA-Z][^\t\n\f\r />\x01]*)/y;
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
 * @param {TemplateStringsArray | string[]} strings
 * @return {ParsedTemplate}
 */
const build = (strings) => {
    const source = strings.join(MARK);
    const { length } = source;
    const hash = templateHash(strings);
    const descriptors = [];
    const segments = [''];
    let clientHtml = '';
    let position = 0;
    let copied = 0; // the source up to here is in the output
    let index = 0; // of the next interpolation

    const fail = (message) => {
        throw new ParseTemplateError(message, { source: source.replaceAll(MARK, '${…}'), position });
    };
    const both = (markup) => {
        clientHtml += markup;
        segments[segments.length - 1] += markup;
    };
    const ssr = (markup) => {
        segments[segments.length - 1] += markup;
    };
    /** copies the source up to the position into the output, as written */
    const copyTo = (to) => {
        both(source.slice(copied, to));
        copied = to;
    };
    /** ends the static segment at a binding, the source up to the position is left out of the output */
    const cut = (descriptor, to) => {
        descriptors.push(descriptor);
        segments.push('');
        copied = to;
    };
    const skipWhitespace = () => {
        while (position < length && WHITESPACE.test(source[position])) position++;
    };

    /**
     * Parses a start tag from its first attribute on, and the content of a raw text element, and writes the element
     * with its marker and without its bound attributes.
     * @param {string} tag
     * @param {number} tagStart - the position of the <
     */
    const parseElement = (tag, tagStart) => {
        const lowerTag = tag.toLowerCase();
        position = tagStart + 1 + tag.length;
        /** @type {{from: number, to: number, descriptor: Descriptor}[]} the bindings in the tag with the source they take */
        const bound = [];
        let marker = -1; // the index of the first binding of the element
        let tokenEnd = position; // the end of the last attribute or the tag name, before the whitespace after it
        let selfClosing = false;
        const bind = (descriptor, span) => {
            if (marker === -1) marker = index;
            bound.push({ from: tokenEnd, to: position, descriptor: { ...descriptor, index, marker } });
            index += span;
        };
        for (;;) {
            tokenEnd = position;
            skipWhitespace();
            if (position >= length) fail(`the start tag <${tag}> is not closed`);
            const char = source[position];
            if (char === '>') {
                position++;
                break;
            }
            if (char === '/' && source[position + 1] === '>') {
                selfClosing = true;
                position += 2;
                break;
            }
            if (char === '/') {
                position++;
                continue;
            }
            if (char === MARK) {
                // an interpolation at an attribute position is a directive
                position++;
                bind({ kind: 'directive' }, 1);
                continue;
            }
            // an attribute: name, optionally = and a value
            const nameStart = position;
            while (
                position < length &&
                !WHITESPACE.test(source[position]) &&
                source[position] !== '=' &&
                source[position] !== '>' &&
                !(source[position] === '/' && source[position + 1] === '>')
            ) {
                position++;
            }
            const name = source.slice(nameStart, position);
            if (name.includes(MARK)) {
                fail(
                    `an interpolation in the attribute name "${name.replaceAll(
                        MARK,
                        '${…}',
                    )}" of <${tag}> is not supported`,
                );
            }
            const nameEnd = position;
            skipWhitespace();
            if (source[position] !== '=') {
                position = nameEnd;
                continue;
            }
            position++;
            skipWhitespace();
            let value;
            const quote = source[position];
            if (quote === '"' || quote === "'") {
                const end = source.indexOf(quote, position + 1);
                if (end === -1) fail(`the value of the attribute "${name}" of <${tag}> is not closed`);
                value = source.slice(position + 1, end);
                position = end + 1;
            } else {
                const valueStart = position;
                while (
                    position < length &&
                    !WHITESPACE.test(source[position]) &&
                    source[position] !== '>' &&
                    !(source[position] === '/' && source[position + 1] === '>')
                ) {
                    position++;
                }
                value = source.slice(valueStart, position);
            }
            if (value.includes(MARK)) {
                const strings = value.split(MARK);
                const span = strings.length - 1;
                if ('?.@'.includes(name[0]) && (span > 1 || strings[0] !== '' || strings[1] !== '')) {
                    fail(
                        `the value of "${name}" on <${tag}> has to be a single interpolation, a boolean, property or event binding takes the whole value`,
                    );
                }
                bind({ kind: 'attribute', name, strings, span }, span);
            }
        }
        const tagEnd = position;

        let content;
        if (rawTextElements.has(lowerTag) && !selfClosing) {
            // the content of a raw text element is text up to its end tag, whatever it looks like. An end tag may
            // carry whitespace before its bracket, a formatter writes </style\n> when it wraps a line
            const endTag = new RegExp(`</${lowerTag}[\\t\\n\\f\\r ]*>`, 'ig');
            endTag.lastIndex = position;
            const match = endTag.exec(source);
            if (!match) fail(`the element <${tag}> has no end tag`);
            const strings = source.slice(position, match.index).split(MARK);
            const span = strings.length - 1;
            if (span > 0) {
                if (marker === -1) marker = index;
                content = {
                    to: match.index,
                    descriptor: { kind: 'text', index, marker, tag: lowerTag, strings, span },
                };
                index += span;
            }
            position = match.index + match[0].length;
        }

        copyTo(tagStart);
        if (marker !== -1) both(partStartMarker(marker));
        for (const { from, to, descriptor } of bound) {
            copyTo(from);
            cut(descriptor, to);
        }
        // the tag is closed without the whitespace in front of the bracket. The browser does not close an element on
        // "/>", the end tag is written for it
        copyTo(tokenEnd);
        copied = tagEnd;
        if (!selfClosing) both('>');
        else both(voidElements.has(lowerTag) ? ' />' : `></${tag}>`);
        if (content) {
            clientHtml += content.descriptor.strings.join('');
            cut(content.descriptor, content.to);
        }
    };

    both(templateStartMarker(hash));
    while (position < length) {
        const char = source[position];
        if (char === MARK) {
            copyTo(position);
            both(partStartMarker(index));
            clientHtml += partEndMarker(index);
            cut({ kind: 'node', index, marker: index }, position + 1);
            ssr(partEndMarker(index));
            index++;
            position++;
            continue;
        }
        if (char === '<') {
            if (source.startsWith('<!--', position)) {
                const end = source.indexOf('-->', position + 4);
                if (end === -1) fail('a comment is not closed');
                if (source.slice(position, end).includes(MARK))
                    fail('an interpolation inside a comment is not supported');
                position = end + 3;
                continue;
            }
            if (source[position + 1] === MARK) fail('an interpolation as a tag name is not supported');
            TAG_NAME.lastIndex = position;
            const tagMatch = TAG_NAME.exec(source);
            if (tagMatch) {
                parseElement(tagMatch[1], position);
                continue;
            }
            if (source[position + 1] === '/') {
                const end = source.indexOf('>', position);
                if (end === -1) fail('an end tag is not closed');
                if (source.slice(position, end).includes(MARK))
                    fail('an interpolation inside an end tag is not supported');
                position = end + 1;
                continue;
            }
        }
        position++;
    }
    copyTo(length);
    both(templateEndMarker);

    const consumed = descriptors.reduce((sum, descriptor) => sum + (descriptor.span ?? 1), 0);
    if (consumed !== strings.length - 1) {
        throw new ParseTemplateError(
            `${strings.length - 1} interpolations in the template, ${consumed} of them could be bound`,
            { source: source.replaceAll(MARK, '${…}'), descriptors },
        );
    }
    return { hash, descriptors, clientHtml, ssrSegments: segments };
};

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
        parsed = build(strings);
        cache.set(strings, parsed);
    }
    return parsed;
};
