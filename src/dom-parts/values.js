import { isObjectLike } from '../util/AttributeParser.js';

/**
 * The rules for what a value means in a binding. The DOM parts and toString() both read them from here, so that
 * client rendering, hydration and server rendering agree.
 */

/**
 * The kind of attribute binding a name stands for.
 * @param {string} name - the attribute name as written in the template, with its prefix
 * @return {'boolean' | 'property' | 'event' | 'onevent' | 'attribute'}
 */
export const attributeKind = (name) => {
    switch (name[0]) {
        case '?':
            return 'boolean';
        case '.':
            return 'property';
        case '@':
            return 'event';
        default:
            // an "old school" event attribute, onclick=${listener}. The value decides at update time whether it is
            // a listener or an attribute that happens to start with "on"
            return name.startsWith('on') ? 'onevent' : 'attribute';
    }
};

/**
 * The event type of an event binding
 * @param {string} name - `@click` or `onclick`
 * @return {string}
 */
export const eventTypeOf = (name) => (name[0] === '@' ? name.slice(1) : name.toLowerCase().slice(2));

/**
 * The text an attribute shows for a value: objects and arrays as JSON, like the attribute reflection of BaseElement
 * writes them, everything else as is.
 * @param {any} value
 * @return {any}
 */
export const attributeValue = (value) => (isObjectLike(value) ? JSON.stringify(value) : value);

/**
 * Whether a boolean attribute is present for a value. The string "false" counts as false, the attribute reflection
 * of BaseElement writes booleans as strings.
 * @param {any} value
 * @return {boolean}
 */
export const isBooleanTrue = (value) => !!value?.valueOf() && value !== 'false';

/**
 * Whether a binding is the whole attribute value, `class="${a}"`, as opposed to `class="link ${a}"` or
 * `class="${a} ${b}"`. Only a whole value carries a kind (boolean, property, event) and keeps its type.
 * @param {{strings: string[], span: number}} descriptor
 * @return {boolean}
 */
export const isWholeValue = ({ strings, span }) => span === 1 && strings[0] === '' && strings[1] === '';

/**
 * Joins the static strings of a binding with its values, for an attribute or a text content with several
 * interpolations. null and undefined write nothing.
 * @param {string[]} strings - the static pieces, one more than the values
 * @param {any[]} values - all values of the template
 * @param {number} index - the index of the first value of the binding
 * @return {string}
 */
export const joinValues = (strings, values, index) => {
    let joined = strings[0];
    for (let position = 1; position < strings.length; position++) {
        const value = values[index + position - 1];
        joined += (value == null ? '' : attributeValue(value)) + strings[position];
    }
    return joined;
};

/**
 * Whether the values of a binding changed since the last update. Compares value by value, so a binding with
 * several interpolations does not join its string for nothing.
 * @param {any[] | undefined} lastValues
 * @param {any[]} values
 * @param {number} index
 * @param {number} span
 * @return {boolean}
 */
export const valuesChanged = (lastValues, values, index, span) => {
    if (!lastValues) return true;
    for (let position = 0; position < span; position++) {
        if (lastValues[position] !== values[index + position]) return true;
    }
    return false;
};
