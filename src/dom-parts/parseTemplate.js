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
 * The client never reads a descriptor out of the HTML, it has the literal. The markers only say where a part sits
 * and, through the hash, whether the server rendered the same literal, see markers.js.
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
 * @property {Map<number, Descriptor[]>} byMarker - the descriptors that hang on each marker
 * @property {boolean} hasRootNodeParts - a child node part sits at the root of the template
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
 * Splits the joined literal into operations: static markup, child node interpolations and elements with their
 * attributes, in document order. Interpolations are classified by where they sit.
 * @param {string} source - the strings joined with MARK
 * @return {object[]}
 */
const tokenize = (source) => {
    const operations = [];
    const { length } = source;
    let position = 0;
    let index = 0; // of the next interpolation
    let depth = 0; // of open elements, a child node interpolation at depth 0 sits at the root
    let text = '';
    const fail = (message) => {
        throw new ParseTemplateError(message, { source: source.replaceAll(MARK, '${…}'), position });
    };
    const flushText = () => {
        if (text) operations.push({ type: 'html', text });
        text = '';
    };
    const skipWhitespace = () => {
        while (position < length && WHITESPACE.test(source[position])) position++;
    };

    /**
     * Parses a start tag from its first attribute on, and the content of a raw text element.
     * @param {string} tag
     */
    const parseElement = (tag) => {
        const lowerTag = tag.toLowerCase();
        const attributes = [];
        let selfClosing = false;
        let firstIndex = -1;
        const bind = (attribute, span) => {
            if (firstIndex === -1) firstIndex = index;
            attribute.index = index;
            index += span;
            attributes.push(attribute);
        };
        for (;;) {
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
                bind({ kind: 'directive' }, 1);
                position++;
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
            if (name.includes(MARK))
                fail(
                    `an interpolation in the attribute name "${name.replaceAll(
                        MARK,
                        '${…}',
                    )}" of <${tag}> is not supported`,
                );
            const beforeEquals = position;
            skipWhitespace();
            if (source[position] !== '=') {
                position = beforeEquals;
                attributes.push({ kind: 'static', name, value: null, quote: '' });
                continue;
            }
            position++;
            skipWhitespace();
            let quote = '';
            let value;
            if (source[position] === '"' || source[position] === "'") {
                quote = source[position];
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
            } else {
                attributes.push({ kind: 'static', name, value, quote });
            }
        }

        const operation = { type: 'element', tag, lowerTag, attributes, selfClosing, firstIndex };
        if (rawTextElements.has(lowerTag) && !selfClosing) {
            // the content of a raw text element is text up to its end tag, whatever it looks like. An end tag may
            // carry whitespace before its bracket, a formatter writes </style\n> when it wraps a line
            const endTag = new RegExp(`</${lowerTag}[\\t\\n\\f\\r ]*>`, 'ig');
            endTag.lastIndex = position;
            const match = endTag.exec(source);
            if (!match) fail(`the element <${tag}> has no end tag`);
            const strings = source.slice(position, match.index).split(MARK);
            const span = strings.length - 1;
            operation.content = { strings, span, index: -1 };
            if (span > 0) {
                if (firstIndex === -1) operation.firstIndex = index;
                operation.content.index = index;
                index += span;
            }
            operation.endTag = match[0];
            position = match.index + match[0].length;
        } else if (!selfClosing && !voidElements.has(lowerTag)) {
            depth++;
        }
        operations.push(operation);
    };

    while (position < length) {
        const char = source[position];
        if (char === MARK) {
            flushText();
            operations.push({ type: 'node', index: index++, root: depth === 0 });
            position++;
            continue;
        }
        if (char === '<') {
            if (source.startsWith('<!--', position)) {
                const end = source.indexOf('-->', position + 4);
                if (end === -1) fail('a comment is not closed');
                const comment = source.slice(position, end + 3);
                if (comment.includes(MARK)) fail('an interpolation inside a comment is not supported');
                text += comment;
                position = end + 3;
                continue;
            }
            if (source[position + 1] === MARK) fail('an interpolation as a tag name is not supported');
            TAG_NAME.lastIndex = position;
            const tagMatch = TAG_NAME.exec(source);
            if (tagMatch) {
                flushText();
                position += tagMatch[0].length;
                parseElement(tagMatch[1]);
                continue;
            }
            if (source[position + 1] === '/') {
                const end = source.indexOf('>', position);
                if (end === -1) fail('an end tag is not closed');
                const endTag = source.slice(position, end + 1);
                if (endTag.includes(MARK)) fail('an interpolation inside an end tag is not supported');
                text += endTag;
                position = end + 1;
                if (depth > 0) depth--;
                continue;
            }
        }
        text += char;
        position++;
    }
    flushText();
    return operations;
};

/**
 * @param {{kind: 'static', name: string, value: string | null, quote: string}} attribute
 * @return {string} the attribute as it stands in the markup
 */
const staticAttribute = ({ name, value, quote }) => {
    if (value === null) return ` ${name}`;
    if (quote === '' && value === '') return ` ${name}`;
    return ` ${name}=${quote}${value}${quote}`;
};

/**
 * @param {TemplateStringsArray | string[]} strings
 * @return {ParsedTemplate}
 */
const build = (strings) => {
    const source = strings.join(MARK);
    const operations = tokenize(source);
    const hash = templateHash(strings);
    const descriptors = [];
    const segments = [''];
    let clientHtml = '';
    let hasRootNodeParts = false;
    const both = (markup) => {
        clientHtml += markup;
        segments[segments.length - 1] += markup;
    };
    const ssr = (markup) => {
        segments[segments.length - 1] += markup;
    };
    const cut = (descriptor) => {
        descriptors.push(descriptor);
        segments.push('');
    };

    both(templateStartMarker(hash));
    for (const operation of operations) {
        if (operation.type === 'html') {
            both(operation.text);
            continue;
        }
        if (operation.type === 'node') {
            const { index } = operation;
            if (operation.root) hasRootNodeParts = true;
            both(partStartMarker(index));
            clientHtml += partEndMarker(index);
            cut({ kind: 'node', index, marker: index });
            ssr(partEndMarker(index));
            continue;
        }
        const { tag, lowerTag, attributes, selfClosing, firstIndex: marker, content, endTag } = operation;
        both((marker === -1 ? '' : partStartMarker(marker)) + `<${tag}`);
        for (const attribute of attributes) {
            if (attribute.kind === 'static') {
                both(staticAttribute(attribute));
            } else if (attribute.kind === 'directive') {
                cut({ kind: 'directive', index: attribute.index, marker });
            } else {
                const { index, name, strings, span } = attribute;
                cut({ kind: 'attribute', index, marker, name, strings, span });
            }
        }
        if (selfClosing) {
            both(voidElements.has(lowerTag) ? ' />' : `></${tag}>`);
        } else {
            both('>');
        }
        if (content) {
            if (content.span > 0) {
                clientHtml += content.strings.join('');
                cut({
                    kind: 'text',
                    index: content.index,
                    marker,
                    tag: lowerTag,
                    strings: content.strings,
                    span: content.span,
                });
            } else {
                both(content.strings[0]);
            }
            both(endTag);
        }
    }
    both(templateEndMarker);

    const consumed = descriptors.reduce((sum, descriptor) => sum + (descriptor.span ?? 1), 0);
    if (consumed !== strings.length - 1) {
        throw new ParseTemplateError(
            `${strings.length - 1} interpolations in the template, ${consumed} of them could be bound`,
            { source: source.replaceAll(MARK, '${…}'), descriptors },
        );
    }
    const byMarker = new Map();
    for (const descriptor of descriptors) {
        const list = byMarker.get(descriptor.marker);
        if (list) list.push(descriptor);
        else byMarker.set(descriptor.marker, [descriptor]);
    }
    return { hash, descriptors, byMarker, hasRootNodeParts, clientHtml, ssrSegments: segments };
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
