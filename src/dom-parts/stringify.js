import { camelToDash, encodeAttribute } from '../util/AttributeParser.js';
import { encodeHTML } from '../util/DOMHelper.js';
import { parseTemplate } from './parseTemplate.js';
import { TemplateResult } from './TemplateResult.js';
import { attributeKind, attributeValue, isBooleanTrue, isWholeValue, joinValues } from './values.js';

/**
 * The server side backend: writes a TemplateResult as markup. The markup carries the same markers as a client
 * render, so that the client can hydrate it. What a value means in a binding comes from values.js, the same rules
 * the DOM parts apply.
 */

// the parser decodes character references inside these raw text elements, the others take their content verbatim
const escapableRawTextElements = new Set(['textarea', 'title']);

/**
 * The markup a child node value writes: text is encoded, templates and arrays render, functions are resolved.
 * @param {any} value
 * @return {string}
 */
export const stringifyValue = (value) => {
    switch (typeof value) {
        case 'string':
            return encodeHTML(value);
        case 'boolean':
        case 'number':
            return String(value);
        case 'function':
            return stringifyValue(value());
        case 'object':
            if (value === null) return '';
            if (Array.isArray(value)) return value.map(stringifyValue).join('');
            if (value instanceof TemplateResult) return value.toString();
            if (value.__unsafeHTML) return value.string;
            console.warn(
                `element-js: toString() writes an object as the text "${String(
                    value,
                )}", pass a primitive, an array, a TemplateResult or unsafeHTML()`,
                value,
            );
    }
    return value == null ? '' : encodeHTML(String(value));
};

/**
 * @param {string} name
 * @param {any} text
 * @return {string} the attribute as markup, always with double quotes
 */
const writeAttribute = (name, text) => ` ${name}="${encodeAttribute(text)}"`;

/**
 * Creates the function that writes the markup of one binding from the values of the template.
 * @param {import('./parseTemplate.js').Descriptor} descriptor
 * @return {(values: any[]) => string}
 */
const createWriter = (descriptor) => {
    const { kind, index } = descriptor;
    if (kind === 'node') {
        return (values) => stringifyValue(values[index]);
    }
    if (kind === 'directive') {
        return (values) => {
            const { directiveClass, values: directiveValues } = values[index];
            const markup = new directiveClass().stringify(...directiveValues);
            return markup ? ` ${markup}` : '';
        };
    }
    if (kind === 'text') {
        const { strings, tag } = descriptor;
        if (escapableRawTextElements.has(tag)) {
            return (values) => encodeHTML(joinValues(strings, values, index));
        }
        const endTag = new RegExp(`</${tag}`, 'i');
        return (values) => {
            const content = joinValues(strings, values, index);
            if (endTag.test(content)) {
                throw new Error(`element-js: the content of <${tag}> contains "</${tag}", which would end the element`);
            }
            return content;
        };
    }
    const { name, strings } = descriptor;
    const writeJoined = (values) => writeAttribute(name, joinValues(strings, values, index));
    const writeWhole = (values) => {
        const value = values[index];
        return value == null ? '' : writeAttribute(name, attributeValue(value));
    };
    const write = isWholeValue(descriptor) ? writeWhole : writeJoined;
    switch (attributeKind(name)) {
        case 'boolean': {
            const attributeName = name.slice(1);
            return (values) => (isBooleanTrue(values[index]) ? ` ${attributeName}=""` : '');
        }
        case 'property': {
            // a property cannot be set in markup, the value is written as the attribute that BaseElement maps back
            // to the property on upgrade: camelCase becomes dash-case
            const attributeName = camelToDash(name.slice(1));
            return (values) => {
                const value = values[index];
                return value == null || value === '' ? '' : writeAttribute(attributeName, attributeValue(value));
            };
        }
        case 'event':
            // listeners have nothing to do on the server
            return () => '';
        case 'onevent':
            // a function is a listener, anything else is an attribute that happens to start with "on"
            return (values) => (typeof values[index] === 'function' ? '' : write(values));
        default:
            return write;
    }
};

/**
 * @param {TemplateResult} templateResult
 * @return {string} the markup, with the markers the client needs to hydrate it
 */
export const stringify = (templateResult) => {
    const { strings, values } = templateResult;
    const parsed = parseTemplate(strings);
    const writers = (parsed.writers ??= parsed.descriptors.map(createWriter));
    const { ssrSegments } = parsed;
    let markup = ssrSegments[0];
    for (let position = 0; position < writers.length; position++) {
        markup += writers[position](values) + ssrSegments[position + 1];
    }
    return markup;
};
