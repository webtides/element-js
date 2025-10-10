import { Part } from './Part.js';

/**
 * @param {Element} node
 * @param {String} name
 * @param {Boolean} oldValue
 * @return {(function(*): void)|*}
 */
const processBooleanAttribute = (node, name, oldValue) => {
    return (newValue) => {
        const value = !!newValue?.valueOf() && newValue !== 'false';
        if (oldValue !== value) {
            node.toggleAttribute(name, (oldValue = !!value));
        }
    };
};

/**
 * @param {Element} node
 * @param {String} name
 * @return {(function(*): void)|*}
 */
const processPropertyAttribute = (node, name) => {
    return (value) => {
        node[name] = value;
    };
};

/**
 * @param {Element} node
 * @param {String} name
 * @return {(function(*): void)|*}
 */
const processEventAttribute = (node, name) => {
    let oldValue = undefined;
    let type = name.startsWith('@') ? name.slice(1) : name.toLowerCase().slice(2);

    return (newValue) => {
        if (oldValue !== newValue) {
            if (oldValue) node.removeEventListener(type, oldValue);
            if ((oldValue = newValue)) node.addEventListener(type, oldValue);
        }
    };
};

/**
 * @param {Element} node
 * @param {String} name
 * @return {(function(*): void)|*}
 */
const processAttribute = (node, name) => {
    let oldValue;
    return (newValue) => {
        const value = newValue?.valueOf();
        if (oldValue !== value) {
            oldValue = value;
            if (value == null) {
                node.removeAttribute(name);
            } else {
                node.setAttribute(name, value);
            }
        }
    };
};

/** @type {Map<Element, AttributePart>} */
const attributePartsCache = new WeakMap();

/**
 * @param {Element} node
 * @param {String} name
 * @return {(function(*): void)|*}
 */
export const processAttributePart = (node, name) => {
    // boolean attribute: ?boolean=${...}
    if (name.startsWith('?')) {
        return processBooleanAttribute(node, name.slice(1), false);
    }

    // property attribute: .property=${...}
    if (name.startsWith('.')) {
        return processPropertyAttribute(node, name.slice(1));
    }

    // event attribute: @event=${...} || "old school" event attribute: onevent=${...}
    if (name.startsWith('@') || name.startsWith('on')) {
        return processEventAttribute(node, name);
    }

    // normal "string" attribute: attribute=${...}
    return processAttribute(node, name);
};

/**
 * For updating a single attribute
 */
export class AttributePart extends Part {
    name = undefined;
    interpolations = 1;
    values = [];
    currentValueIndex = 0;
    initialValue = undefined;

    /**
     * @param {Comment} node
     * @param {String} name
     * @param {String} initialValue
     */
    constructor(node, name, initialValue) {
        // If we have multiple attribute parts with the same name, it means we have multiple
        // interpolations inside that attribute. Instead of creating a new part, we will return the same
        // as before and let it defer the update until the last interpolation gets updated
        const attributePart = attributePartsCache.get(node.nextElementSibling);
        if (attributePart && attributePart.name === name) {
            attributePart.interpolations++;
            node.__part = attributePart; // add Part to comment node for debugging in the browser
            return attributePart;
        }

        super();
        this.name = name;
        this.initialValue = initialValue;
        this.processor = processAttributePart(node.nextElementSibling, this.name);
        node.__part = this; // add Part to comment node for debugging in the browser
        attributePartsCache.set(node.nextElementSibling, this);
    }

    /**
     * @param {string | number | bigint | boolean | undefined | symbol | null} value
     */
    update(value) {
        // If we only have one sole interpolation, we can just apply the update
        if (this.initialValue === '\x03') {
            this.processor(value);
            return;
        }

        // Instead of applying the update immediately, we check if the part has multiple interpolations
        // and store the values for each interpolation in a list
        this.values[this.currentValueIndex++] = value;

        // Only the last call to update (for the last interpolation) will actually trigger the update
        // on the DOM processor. Here we can reset everything before the next round of updates
        if (this.interpolations === this.currentValueIndex) {
            this.currentValueIndex = 0;
            let replaceIndex = 0;
            // Note: this will coarse the values into strings, but it's probably ok since there can only be multiple values in string attributes?!
            const parsedValue = this.initialValue.replace(/\x03/g, () => this.values[replaceIndex++]);
            this.processor(parsedValue);
        }
    }
}
