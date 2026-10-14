import { COMMENT_NODE, encodeHTML } from '../util/DOMHelper.js';
import { encodeAttribute, isObjectLike } from '../util/AttributeParser.js';
import { TemplatePart } from './TemplatePart.js';
import { walkPartMarkers } from './PartMarkers.js';

const voidElements = /^(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;
const rawTextElements = /<(script|style|textarea|title)([^>]*)>(.*?)<\/\1>/i;
const elements = /<([a-z]+[a-z0-9:._-]*)([^>]*?)(\/?)>/g;
// TODO: v this will not match any values with escaped quotes like onClick='console.log("\'test")'
const attributes = /([^\s=]*)=((?:")[^"]*(?:")|(?:')[^']*(?:')|[^\s\/>]*)|([^\s\/>]*)/g;
const partPositions = /[\x01\x02]/g;
const ssrPlaceholder = /{{dom-part\?(.*?)}}/g;
// \x01 Node.ELEMENT_NODE
// \x02 Node.ATTRIBUTE_NODE
// \x03 COMMENT.ATTRIBUTE_TOKEN
// \x04 Node.ATTRIBUTE_TOKEN

/**
 * Creates a URL query string for meta information to pass along ssr part placeholders
 * @param type
 * @param params
 * @return {string}
 */
function makeSSRPlaceholderParams(type, params) {
    const urlSearchParams = new URLSearchParams({ type, ...params });
    const queryString = urlSearchParams.toString();
    return `{{dom-part?${queryString}}}`;
}

/**
 * Creates a URL query string for meta information to pass along part comments
 * @param {string} type
 * @param {{}} params
 * @return {string}
 */
function makePartParams(type, params) {
    const urlSearchParams = new URLSearchParams({ type, ...params });
    return urlSearchParams.toString();
}

/**
 * Given a template, find part positions as both nodes and attributes and
 * return a string with placeholders as either comment nodes or named attributes.
 * @param {TemplateStringsArray | string[]} templateStrings a template literal tag array
 * @param {boolean} ssr replace interpolations with placeholders
 * @returns {string} X/HTML with prefixed comments or attributes
 */
export const createTemplateString = (templateStrings, ssr = false) => {
    let partIndex = 0;
    // join all interpolations (for values) with a special placeholder and remove any whitespace
    let template = templateStrings.join('\x01').trim();
    // find (match) all elements to identify their attributes
    template = template.replace(elements, (_, name, attributesString, trailingSlash) => {
        let elementTagWithAttributes = name + attributesString;
        // TODO the closing case is weird.
        if (trailingSlash.length) elementTagWithAttributes += voidElements.test(name) ? ' /' : '></' + name;
        // collect all attribute parts so that we can place matching comment nodes
        const attributeParts = attributesString.replace(attributes, (attribute, name, valueWithQuotes, directive) => {
            if (directive && directive === '\x01') {
                elementTagWithAttributes = elementTagWithAttributes.replace(
                    attribute,
                    ssr ? makeSSRPlaceholderParams('directive') : '',
                );
                const params = makePartParams('directive');
                return `<!--\x02?${params}-->`;
            }

            // remove quotes from attribute value to normalize the value
            const hasQuotes = valueWithQuotes?.startsWith('"') || valueWithQuotes?.startsWith("'");
            const quotes = hasQuotes ? valueWithQuotes.at(0) : '';
            const value = hasQuotes ? valueWithQuotes.slice(1, -1) : valueWithQuotes;
            const partsCount = (attribute.match(/\x01/g) || []).length;
            const parts = [];
            for (let index = 0; index < partsCount; index++) {
                const params = makePartParams('attribute', {
                    name,
                    initialValue: value.replaceAll('\x01', '\x03'),
                });
                parts.push(`<!--\x02?${params}-->`);
            }

            if (parts.length > 0) {
                let replacement = '';
                if (ssr) {
                    for (let index = 0; index < partsCount - 1; index++) {
                        replacement = replacement + makeSSRPlaceholderParams('noop');
                    }
                    replacement =
                        replacement +
                        makeSSRPlaceholderParams('attribute', {
                            name,
                            interpolations: partsCount,
                            initialValue: value.replaceAll('\x01', '\x03'),
                            quotes,
                        });
                }
                elementTagWithAttributes = elementTagWithAttributes.replace(attribute, replacement);
            }

            return parts.join('');
        });
        // TODO create test to check if lf are in place
        return `
				${attributesString.includes('\x01') ? attributeParts : ''}\n
				<${elementTagWithAttributes.trimEnd()}>\n
			`.trim();
    });
    /**
     * Processes the HTML template content by identifying specific "raw text" nodes (e.g., <script>, <style>, <textarea>, <title>)
     * and inserts comments before each instance of an interpolation within these nodes.
     * The placeholders are represented by a control character (in this case, "\x01").
     *
     * Explanation of logic:
     * - The main regex, `rawTextElements`, identifies and captures specific HTML tags (script, style, textarea, title)
     *   along with their attributes and content. This regex captures:
     *     1. `tag`: The tag name (e.g., "textarea").
     *     2. `attributes`: Any attributes within the opening tag (e.g., `foo="bar"`).
     *     3. `content`: The inner content within the tag (which may contain interpolations).
     * - Inside the replace function:
     *     - The number of placeholder occurrences (`\x01` instances) in `content` is counted to determine
     *       how many parts (comments) should be generated.
     *     - An array `parts` is created, where each entry represents a comment to be inserted before the raw text node.
     *       Each comment includes a modified version of `content` where each placeholder (`\x01`) is replaced with a
     *       different control character (`\x03`) for later differentiation.
     *     - The `content` is then modified by removing each interpolation (`\x01` is removed), leaving the raw text
     *       content without markers.
     *     - The processed comments in `parts` are joined and placed before the modified raw text node, preserving
     *       its tag, attributes, and inner content without placeholders.
     * - The function finally returns the modified template string with comments in the correct places.
     */
    template = template.replace(rawTextElements, (match, tag, attributes, content) => {
        const partsCount = (content.match(/\x01/g) || []).length;
        const parts = [];
        for (let index = 0; index < partsCount; index++) {
            const params = makePartParams('raw-text-node', {
                initialValue: content.replaceAll('\x01', '\x03'),
            });
            parts.push(`<!--\x02?${params}-->`);
        }
        const parsedContent = content.replaceAll('\x01', ssr ? makeSSRPlaceholderParams('raw-text-node') : '');
        return `${parts.join('')}<${tag}${attributes}>${parsedContent}</${tag}>`;
    });
    // replace interpolation placeholders with our indexed markers
    template = template.replace(partPositions, (partPosition) => {
        if (partPosition === '\x01') {
            const placeholder = ssr ? makeSSRPlaceholderParams('node') : '';
            return `<!--dom-part-${partIndex}-->${placeholder}<!--/dom-part-${partIndex++}-->`;
        } else if (partPosition === '\x02') {
            return `dom-part-${partIndex++}`;
        }
    });
    // TODO create test to check if lf are in place
    // /n is important in the returns as we expect a certain order of text / comments an nodes
    return `<!--template-part-->\n${template}\n<!--/template-part-->`.trim();
};

/**
 * @param {String} name
 * @param {any} value
 * @param {string} quotes
 * @return {String}
 */
const attribute = (name, value, quotes = '"') => {
    return ` ${name}=${quotes}${encodeAttribute(isObjectLike(value) ? JSON.stringify(value) : value)}${quotes}`;
};

/**
 * @param {any} value
 * @return {String}
 */
const getValue = (value) => {
    switch (typeof value) {
        case 'string':
            return encodeHTML(value);
        case 'boolean':
        case 'number':
            return String(value);
        case 'object':
            switch (true) {
                case value === null:
                    return '';
                case Array.isArray(value):
                    return value.map(getValue).join('');
                case value instanceof TemplateResult:
                    return value.toString();
                case value.__unsafeHTML:
                    return value.string;
                default:
                    console.log('Cannot getValue for', value);
            }
            break;
        case 'function':
            return getValue(value());
    }
    return value == null ? '' : encodeHTML(String(value));
};

/** @type {Map<TemplateStringsArray, string>} */
const ssrTemplateStringsCache = new WeakMap();

/** @type {Map<TemplateStringsArray, (() => String)[]>} */
const ssrUpdatesCache = new WeakMap();

/** @type {Map<Element, TemplatePart>} */
const templatePartsCache = new WeakMap();

/**
 * @param {Node[] | NodeList} childNodes
 * @return {Comment|undefined} the first `<!--template-part-->` comment among the nodes
 */
const findTemplatePartStartNode = (childNodes) =>
    Array.from(childNodes).find((node) => node.nodeType === COMMENT_NODE && node.data === 'template-part');

/**
 * Parses the descriptor of a part from the data of its comment marker.
 * For html`<div id="${'foo'}" class="${'bar'}">${'baz'}</div>` the markers are:
 * <!--dom-part-0?type=attribute&name=id&initialValue=\x03--><!--dom-part-1?type=attribute&name=class&initialValue=\x03--><div><!--dom-part-2-->
 * @param {string} data
 * @return {{type: string, name?: string, initialValue?: string}}
 */
const parsePartDescriptor = (data) => {
    const query = data.indexOf('?');
    if (query === -1) {
        return { type: 'node' };
    }
    const searchParams = new URLSearchParams(data.slice(query + 1));
    const type = searchParams.get('type');
    if (type === 'attribute') {
        return { type, name: searchParams.get('name'), initialValue: searchParams.get('initialValue') };
    }
    if (type === 'raw-text-node') {
        return { type, initialValue: searchParams.get('initialValue') };
    }
    if (type === 'directive') {
        return { type };
    }
    throw new Error(`TemplateResult: unknown part type "${type}" in marker "${data}"`);
};

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
     * Renders into a DOM node. A node that already holds a rendered instance of this template is updated, a node with
     * server rendered markup (a `<!--template-part-->` marker) is hydrated, anything else is replaced by a fresh render.
     * @param {Element} domNode
     */
    renderInto(domNode) {
        const startNode = findTemplatePartStartNode(domNode.childNodes);

        let templatePart = templatePartsCache.get(domNode);
        if (templatePart && startNode) {
            templatePart.update(this);
            return;
        }

        templatePart = new TemplatePart(startNode, this);
        templatePartsCache.set(domNode, templatePart);

        if (templatePart.hydrated) {
            templatePart.hydrate(this);
        } else {
            templatePart.update(this);
            domNode.replaceChildren(...templatePart.childNodes);
        }
    }

    /**
     * @param {TemplateStringsArray} strings
     * @return {(() => String)[]}
     */
    parseSSRUpdates(strings) {
        let templateString = ssrTemplateStringsCache.get(strings);

        if (!templateString) {
            templateString = createTemplateString(strings, true);
            ssrTemplateStringsCache.set(strings, templateString);
        }

        let updates = ssrUpdatesCache.get(strings);

        if (!updates) {
            const partMatches = [...templateString.matchAll(ssrPlaceholder)].map((match) => match[0]);
            updates = partMatches.flatMap((match) => {
                const placeholderContent = match.replace('{{', '').replace('}}', '');
                const [_, paramsString] = placeholderContent.split('?');
                const searchParams = new URLSearchParams(paramsString);
                const type = searchParams.get('type');
                if (type === 'noop') return [];
                if (type === 'attribute') {
                    const name = searchParams.get('name');
                    const quotes = searchParams.get('quotes');

                    if (name.startsWith('?')) {
                        const booleanName = name.replace('?', '');
                        return [
                            {
                                type: 'attribute',
                                processor: (value) => {
                                    if (!value) return '';
                                    return `${booleanName}=""`;
                                },
                            },
                        ];
                    }

                    if (name.startsWith('.')) {
                        const propertyName = name.replace('.', '');
                        return [
                            {
                                type: 'attribute',
                                processor: (value) => {
                                    // null, undefined, and false are not shown at all
                                    if (value === null || value === undefined || value === '') {
                                        return '';
                                    }
                                    // in all other cases, just escape it in quotes
                                    return attribute(propertyName, value, quotes);
                                },
                            },
                        ];
                    }

                    if (name.startsWith('@') || name.startsWith('on')) {
                        return [
                            {
                                type: 'attribute',
                                processor: (value) => {
                                    // event handlers have nothing to do on the server side
                                    return '';
                                },
                            },
                        ];
                    }

                    const interpolations = searchParams.get('interpolations');
                    let values = [];
                    const attributeUpdates = [];
                    for (let index = 0; index < interpolations - 1; index++) {
                        attributeUpdates.push({
                            type: 'noop',
                            processor: (value) => {
                                values.push(value);
                                return '';
                            },
                        });
                    }
                    attributeUpdates.push({
                        type: 'attribute',
                        name: searchParams.get('name'),
                        interpolations,
                        initialValue: searchParams.get('initialValue'),
                        processor: (value) => {
                            values.push(value);
                            const initialValue = searchParams.get('initialValue');
                            let replaceIndex = 0;
                            // Note: this will coarse the values into strings, but it's probably ok since there can only be multiple values in string attributes?!
                            const parsedValue = initialValue.replace(/\x03/g, () => values[replaceIndex++]);
                            values = [];
                            return attribute(searchParams.get('name'), parsedValue, quotes);
                        },
                    });
                    return attributeUpdates;
                }
                if (type === 'node') return [{ type: 'node', processor: (value) => getValue(value) }];
                if (type === 'raw-text-node') return [{ type: 'raw-text-node', processor: (value) => getValue(value) }];
                if (type === 'directive')
                    return [
                        {
                            type: 'directive',
                            processor: (value) => {
                                const directive = new value.directiveClass();
                                return directive.stringify(...value.values);
                            },
                        },
                    ];
            });
            ssrUpdatesCache.set(strings, updates);
        }

        // We couldn't correctly parse updates from the template
        if (updates.length !== strings.length - 1) {
            throw {
                name: 'ParseTemplateError',
                message: 'Could not parse updates from template correctly. Updates length has not the expected length.',
                strings,
                templateString,
                updates,
            };
        }

        return updates;
    }

    /**
     * Parses the part descriptors of this template from the comment markers of its rendered or cloned nodes.
     * The descriptors are indexed like the values of the template.
     * @param {Node[] | NodeList} childNodes - the top level nodes of a template instance, including the template-part markers
     * @return {{type: string, name?: string, initialValue?: string}[]}
     */
    parseParts(childNodes) {
        const startNode = findTemplatePartStartNode(childNodes);
        const parts = [];
        if (startNode) {
            walkPartMarkers(startNode, (node, index) => {
                parts[index] = parsePartDescriptor(node.data);
            });
        }

        // We couldn't correctly parse parts from the template
        if (parts.length !== this.strings.length - 1 || parts.includes(undefined)) {
            throw {
                name: 'ParseTemplateError',
                message:
                    'Could not parse parts from template correctly. Parts length has not the expected length. -> ' +
                    JSON.stringify({
                        strings: this.strings,
                        templateString: this.templateString,
                        childNodes,
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
        const updates = this.parseSSRUpdates(this.strings);
        let template = ssrTemplateStringsCache.get(this.strings);

        let index = 0;
        return template.replaceAll(ssrPlaceholder, () => {
            return updates[index].processor(this.values[index++]);
        });
    }
}
