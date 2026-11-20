import { ElementPart } from './ElementPart.js';
import { attributeValue, eventTypeOf, isBooleanTrue, isWholeValue, joinValues } from './values.js';

/**
 * An attribute with one or more interpolations, `class="${a}"` or `class="link ${a} ${b}"`. A whole value writes
 * objects and arrays as JSON and removes the attribute for null and undefined, several interpolations join to a
 * string.
 */
export class AttributePart extends ElementPart {
    /** @type {string} */
    name;

    /** @type {boolean} the binding is the whole attribute value */
    whole;

    /**
     * @param {Element} element
     * @param {import('./parseTemplate.js').AttributeDescriptor} descriptor
     * @param {string} [name] - the attribute name without its prefix
     */
    constructor(element, descriptor, name = descriptor.name) {
        super(element, descriptor);
        this.name = name;
        this.whole = isWholeValue(descriptor);
    }

    /**
     * @param {any[]} values
     * @return {string | null} the text of the attribute, null removes it
     */
    valueFrom(values) {
        const { index, strings } = this.descriptor;
        if (!this.whole) return joinValues(strings, values, index);
        const value = values[index];
        return value == null ? null : String(attributeValue(value));
    }

    read() {
        return this.element.getAttribute(this.name);
    }

    /**
     * @param {string | null} text
     */
    write(text) {
        if (text === null) {
            this.element.removeAttribute(this.name);
        } else {
            this.element.setAttribute(this.name, text);
        }
    }
}

/**
 * A boolean attribute, `?disabled="${flag}"`. Present as `disabled=""`, the string "false" counts as false.
 */
export class BooleanAttributePart extends AttributePart {
    /**
     * @param {Element} element
     * @param {import('./parseTemplate.js').AttributeDescriptor} descriptor
     */
    constructor(element, descriptor) {
        super(element, descriptor, descriptor.name.slice(1));
    }

    /**
     * Not toggleAttribute(): server rendered markup may carry `name="false"`, true has to become `name=""`.
     * @param {any[]} values
     * @return {'' | null}
     */
    valueFrom(values) {
        return isBooleanTrue(values[this.descriptor.index]) ? '' : null;
    }
}

/**
 * A property, `.value="${text}"`. Markup carries no properties, the first value is always set.
 */
export class PropertyPart extends ElementPart {
    /** @type {string} */
    name;

    /**
     * @param {Element} element
     * @param {import('./parseTemplate.js').AttributeDescriptor} descriptor
     */
    constructor(element, descriptor) {
        super(element, descriptor);
        this.name = descriptor.name.slice(1);
    }

    write(value) {
        this.element[this.name] = value;
    }
}

/**
 * An event listener, `@click="${listener}"`.
 */
export class EventPart extends ElementPart {
    /** @type {string} */
    type;

    /**
     * @param {Element} element
     * @param {import('./parseTemplate.js').AttributeDescriptor} descriptor
     */
    constructor(element, descriptor) {
        super(element, descriptor);
        this.type = eventTypeOf(descriptor.name);
    }

    /**
     * There is no listener before the first write.
     */
    read() {
        return undefined;
    }

    write(listener) {
        if (this.oldValue) this.element.removeEventListener(this.type, this.oldValue);
        if (listener) this.element.addEventListener(this.type, listener);
    }
}

/**
 * An attribute that starts with "on", `onclick="${value}"`. A function is the listener, any other value is written
 * as an attribute: `on="${state}"` or `once="${flag}"` are attributes of the element that happen to start with "on".
 */
export class OnEventPart extends AttributePart {
    /** @type {string} */
    type;

    /**
     * @param {Element} element
     * @param {import('./parseTemplate.js').AttributeDescriptor} descriptor
     */
    constructor(element, descriptor) {
        super(element, descriptor);
        this.type = eventTypeOf(descriptor.name);
    }

    /**
     * @param {any[]} values
     * @return {Function | string | null} the listener, or the text of the attribute
     */
    valueFrom(values) {
        const value = values[this.descriptor.index];
        return typeof value === 'function' ? value : super.valueFrom(values);
    }

    write(value) {
        const { element, type, oldValue } = this;
        const wasListener = typeof oldValue === 'function';
        const isListener = typeof value === 'function';
        if (wasListener) element.removeEventListener(type, oldValue);
        if (isListener) element.addEventListener(type, value);
        // any other value is the attribute, a listener has none
        if (!isListener) {
            super.write(value);
        } else if (!wasListener && oldValue !== null) {
            super.write(null);
        }
    }
}
