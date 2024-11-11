import { COMMENT_NODE, getNodePath } from '../util/DOMHelper.js';
import { encodeAttribute, isObjectLike } from '../util/AttributeParser.js';
import { TemplatePart } from './TemplatePart.js';

const voidElements = /^(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;
const rawTextElements = /<(script|style|textarea|title)([^>]*)>(.*?)<\/\1>/i;
const elements = /<([a-z]+[a-z0-9:._-]*)([^>]*?)(\/?)>/g;
// TODO: v this will not match any values with escaped quotes like onClick='console.log("\'test")'
const attributes = /([^\s]*)=((?:")[^"]*(?:")|(?:')[^']*(?:')|[^\s\/>]*)|([^\s\/>]*)/g;
const partPositions = /[\x01\x02]/g;
// \x01 Node.ELEMENT_NODE
// \x02 Node.ATTRIBUTE_NODE
// \x03 COMMENT.ATTRIBUTE_TOKEN
// \x04 Node.ATTRIBUTE_TOKEN

const ssrPlaceholder = /{{dom-part\?(.*?)}}/g;
function makeSSRPlaceholder(type, params) {
    const urlSearchParams = new URLSearchParams({ type, ...params });
    const queryString = urlSearchParams.toString();
    return `{{dom-part?${queryString}}}`;
}

/**
 * Given a template, find part positions as both nodes and attributes and
 * return a string with placeholders as either comment nodes or named attributes.
 * @param {TemplateStringsArray | string[]} templateStrings a template literal tag array
 * @param {boolean} ssr replace interpolations with placeholders
 * @returns {string} X/HTML with prefixed comments or attributes
 */
export const createTemplateString = (templateStrings, ssr = false) => {
    // TODO: make it easier to identify attribute and node parts for SSR and leave the comments at those positions to be replaced in toString()
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
                    ssr ? makeSSRPlaceholder('directive') : '',
                );
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
                // TODO: maybe we could use url parameters here?! -> ?type=attribute&name=${name}&initialValue=${initialValue}
                parts.push(`<!--\x02:${name}=${value.replaceAll('\x01', '\x03')}-->`);
            }

            if (parts.length > 0) {
                // TODO: we need to handle special attributes (?|.|@) differently ?!
                // TODO: or we can tell multiple attribute interpolations to not set the attribute name?!
                let replacement = '';
                if (ssr) {
                    for (let index = 0; index < partsCount - 1; index++) {
                        replacement = replacement + makeSSRPlaceholder('noop');
                    }
                    replacement =
                        replacement +
                        makeSSRPlaceholder('attribute', {
                            name,
                            interpolations: partsCount,
                            initialValue: value.replaceAll('\x01', '\x03'),
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
            // TODO: maybe we could use url parameters here?! -> ?type=raw-text-node&initialValue=${initialValue}
            parts.push(`<!--\x02/raw-text-node=${content.replaceAll('\x01', '\x03')}-->`);
        }
        const parsedContent = content.replaceAll('\x01', ssr ? makeSSRPlaceholder('raw-text-node') : '');
        return `${parts.join('')}<${tag}${attributes}>${parsedContent}</${tag}>`;
    });
    // replace interpolation placeholders with our indexed markers
    template = template.replace(partPositions, (partPosition) => {
        if (partPosition === '\x01') {
            if (ssr) {
                return `<!--dom-part-${partIndex}-->${makeSSRPlaceholder('node')}<!--/dom-part-${partIndex++}-->`;
            }
            return `<!--dom-part-${partIndex}--><!--/dom-part-${partIndex++}-->`;
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
 * @return {String}
 */
const attribute = (name, value) => {
    return ` ${name}="${encodeAttribute(isObjectLike(value) ? JSON.stringify(value) : value)}"`;
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
    return value == null ? '' : encodeAttribute(String(value));
};

/** @type {Map<TemplateStringsArray, string>} */
const ssrTemplateStringsCache = new WeakMap();

/** @type {Map<TemplateStringsArray, (() => String)[]>} */
const ssrUpdatesCache = new WeakMap();

/** @type {Map<Element, TemplatePart>} */
const templatePartsCache = new WeakMap();

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
        let templatePart = templatePartsCache.get(domNode);
        if (!templatePart) {
            const startNode = Array.from(domNode.childNodes)
                .filter((node) => node.nodeType === COMMENT_NODE)
                .find((node) => node.data === 'template-part');

            serverSideRendered = startNode !== undefined;

            templatePart = new TemplatePart(startNode, this);
            templatePartsCache.set(domNode, templatePart);

            if (!serverSideRendered) {
                domNode.replaceChildren(...templatePart.childNodes);
            }
        } else {
            templatePart.update(this);
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
                                    return attribute(propertyName, value);
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
                            return attribute(searchParams.get('name'), parsedValue);
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
        let node = treeWalker.nextNode(); //to skip the root template-part
        const parts = [];

        let nestedLevel = 0;
        // search for parts through numbered comment nodes with placeholders
        while ((node = treeWalker.nextNode())) {
            if (/^template-part$/.test(node.data)) {
                nestedLevel++;
                continue;
            }
            if (/^\/template-part$/.test(node.data)) {
                if (nestedLevel > 0) {
                    nestedLevel--;
                }
                continue;
            }
            if (nestedLevel > 0) {
                continue;
            }
            if (/^dom-part-\d+$/.test(node.data)) {
                parts.push({ type: 'node', path: getNodePath(node) });
                continue;
            }
            if (/^dom-part-\d+:/.test(node.data)) {
                const [_, ...attribute] = node.data.split(':');
                const [name, ...initialValue] = attribute.join(':').split('=');
                parts.push({
                    type: 'attribute',
                    path: getNodePath(node),
                    name: name,
                    initialValue: initialValue.join('='),
                });
                continue;
            }
            if (/^dom-part-\d+\/raw-text-node/.test(node.data)) {
                // For html`<textarea>${'foo'} bar</textarea>` we will get:
                // <!--dom-part-0/raw-text-node=\x03 bar-->
                const [_, ...initialValue] = node.data.split('=');
                parts.push({
                    type: 'raw-text-node',
                    path: getNodePath(node),
                    initialValue: initialValue.join('='),
                });
                continue;
            }
            if (/^dom-part-\d+\$/.test(node.data)) {
                parts.push({ type: 'directive', path: getNodePath(node) });
            }
        }

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
        const updates = this.parseSSRUpdates(this.strings);
        let template = ssrTemplateStringsCache.get(this.strings);

        let index = 0;
        return template.replaceAll(ssrPlaceholder, () => {
            return updates[index].processor(this.values[index++]);
        });
    }
}
