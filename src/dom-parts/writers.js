import { attributeKind, attributeValue, eventTypeOf, isBooleanTrue, isWholeValue } from './values.js';

/**
 * The DOM writers of the element parts. A writer takes the value of a binding, brings one attribute, property,
 * listener or text content of an element in line with it and remembers what it wrote, so that an unchanged value
 * costs no DOM access.
 */

// marks the first write
const NOT_SET = Symbol('not set');

/**
 * @param {(value: any) => void} write
 * @param {() => any} [read] - the value that is in the DOM. The writer reads it once, on its first write: a fresh
 * clone has nothing there yet and gets written, server rendered markup that fits already is left alone
 * @return {(value: any) => void}
 */
const domWriter = (write, read) => {
    let oldValue = NOT_SET;
    return (value) => {
        if (oldValue === NOT_SET && read) oldValue = read();
        if (oldValue === value) return;
        oldValue = value;
        write(value);
    };
};

/**
 * @param {Element} element
 * @param {string} name
 * @return {(text: string | null) => void} writes the text as the attribute, null removes the attribute
 */
const attributeWriter = (element, name) =>
    domWriter(
        (text) => (text === null ? element.removeAttribute(name) : element.setAttribute(name, text)),
        () => element.getAttribute(name),
    );

/**
 * @param {Element} element
 * @return {(text: string) => void}
 */
export const textContentWriter = (element) =>
    domWriter(
        (text) => {
            element.textContent = text;
        },
        () => element.textContent,
    );

/**
 * @param {Element} element
 * @param {string} name - `@type` or `ontype`
 * @return {(listener: any) => void}
 */
const listenerWriter = (element, name) => {
    const type = eventTypeOf(name);
    let oldValue = undefined;
    return (listener) => {
        if (oldValue === listener) return;
        if (oldValue) element.removeEventListener(type, oldValue);
        oldValue = listener;
        if (listener) element.addEventListener(type, listener);
    };
};

/**
 * The writer of an attribute binding. A binding that is the whole attribute value keeps the type of its value and
 * writes according to the kind of its name, every other binding joins to a string and writes an attribute.
 * @param {Element} element
 * @param {import('./parseTemplate.js').AttributeDescriptor} descriptor
 * @return {(value: any) => void}
 */
export const createWriter = (element, descriptor) => {
    const { name } = descriptor;
    const attribute = attributeWriter(element, name);
    if (!isWholeValue(descriptor)) return attribute;
    const text = (value) => attribute(value == null ? null : String(attributeValue(value)));
    switch (attributeKind(name)) {
        case 'boolean': {
            // not toggleAttribute(): server rendered markup may carry `name="false"`, true has to become `name=""`
            const present = attributeWriter(element, name.slice(1));
            return (value) => present(isBooleanTrue(value) ? '' : null);
        }
        case 'property': {
            const property = name.slice(1);
            return domWriter((value) => {
                element[property] = value;
            });
        }
        case 'event':
            return listenerWriter(element, name);
        case 'onevent': {
            // a function is the listener, any other value is written as an attribute: `on="${state}"` or
            // `once="${flag}"` are attributes of the element that happen to start with "on"
            const listener = listenerWriter(element, name);
            return (value) => {
                const isListener = typeof value === 'function';
                listener(isListener ? value : undefined);
                text(isListener ? undefined : value);
            };
        }
        default:
            return text;
    }
};
