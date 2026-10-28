import { Part } from './Part.js';
import {
    attributeKind,
    attributeValue,
    eventTypeOf,
    isBooleanTrue,
    isWholeValue,
    joinValues,
    valuesChanged,
} from './values.js';

// marks the first commit: it compares with the attribute in the DOM once, so a fresh clone, which has no attribute
// yet, gets written and server rendered markup that fits already is left alone
const NOT_SET = Symbol('not set');

/**
 * @param {Element} element
 * @param {string} name
 * @return {(value: any) => void}
 */
const commitAttribute = (element, name) => {
    let committed = NOT_SET;
    return (value) => {
        const text = value == null ? null : String(attributeValue(value));
        if (committed === NOT_SET && element.getAttribute(name) === text) {
            committed = text;
            return;
        }
        if (committed === text) return;
        committed = text;
        if (text === null) {
            element.removeAttribute(name);
        } else {
            element.setAttribute(name, text);
        }
    };
};

/**
 * @param {Element} element
 * @param {string} name - without the ? prefix
 * @return {(value: any) => void}
 */
const commitBooleanAttribute = (element, name) => {
    let committed = NOT_SET;
    return (value) => {
        const present = isBooleanTrue(value);
        if (committed === NOT_SET && element.getAttribute(name) === (present ? '' : null)) {
            committed = present;
            return;
        }
        if (committed === present) return;
        committed = present;
        // not toggleAttribute(): server rendered markup may carry `name="false"`, true has to become `name=""`
        if (present) {
            element.setAttribute(name, '');
        } else {
            element.removeAttribute(name);
        }
    };
};

/**
 * @param {Element} element
 * @param {string} name - without the . prefix
 * @return {(value: any) => void}
 */
const commitProperty = (element, name) => {
    let committed = NOT_SET;
    return (value) => {
        if (committed === value) return;
        committed = value;
        element[name] = value;
    };
};

/**
 * @param {Element} element
 * @param {string} name - `@type` or `ontype`
 * @return {(listener: any) => void}
 */
const commitListener = (element, name) => {
    const type = eventTypeOf(name);
    let committed = undefined;
    return (listener) => {
        if (committed === listener) return;
        if (committed) element.removeEventListener(type, committed);
        committed = listener;
        if (listener) element.addEventListener(type, listener);
    };
};

/**
 * @param {Element} element
 * @param {string} name - the attribute name as written in the template, with its prefix
 * @return {(value: any) => void} writes one value to the element according to the kind of binding
 */
const createCommit = (element, name) => {
    switch (attributeKind(name)) {
        case 'boolean':
            return commitBooleanAttribute(element, name.slice(1));
        case 'property':
            return commitProperty(element, name.slice(1));
        case 'event':
            return commitListener(element, name);
        case 'onevent': {
            // a function is the listener, any other value is written as an attribute: `on="${state}"` or
            // `once="${flag}"` are attributes of the element that happen to start with "on"
            const listener = commitListener(element, name);
            const attribute = commitAttribute(element, name);
            return (value) => {
                const isListener = typeof value === 'function';
                listener(isListener ? value : undefined);
                attribute(isListener ? undefined : value);
            };
        }
        default:
            return commitAttribute(element, name);
    }
};

/**
 * One attribute of an element with one or more interpolations: `class="${a} ${b}"`, `?disabled="${flag}"`,
 * `.value="${text}"`, `@click="${listener}"`.
 */
export class AttributePart extends Part {
    /** @type {import('./parseTemplate.js').AttributeDescriptor} */
    descriptor;

    /** @type {any[] | undefined} the values of the last update, for an attribute with several interpolations */
    lastValues = undefined;

    /**
     * @param {Element} element
     * @param {import('./parseTemplate.js').AttributeDescriptor} descriptor
     */
    constructor(element, descriptor) {
        super();
        this.descriptor = descriptor;
        // static text around the interpolation or several interpolations always join to a string attribute, the
        // parser rejects both for the other kinds
        this.whole = isWholeValue(descriptor);
        this.commit = this.whole ? createCommit(element, descriptor.name) : commitAttribute(element, descriptor.name);
    }

    /**
     * @param {any[]} values
     */
    update(values) {
        const { index, span, strings } = this.descriptor;
        if (this.whole) {
            this.commit(values[index]);
            return;
        }
        if (!valuesChanged(this.lastValues, values, index, span)) return;
        this.lastValues = values.slice(index, index + span);
        this.commit(joinValues(strings, values, index));
    }
}
