/**
 * Tests if a value is of type `object`
 * @param {any} value
 * @returns {boolean}
 */
export function isObjectLike(value) {
    return typeof value == 'object' && value !== null;
}

/**
 * Tests if a value can be parsed as JSON
 * @param {any} value
 * @returns {boolean}
 */
export function isJSON(value) {
    try {
        return JSON.parse(value) && !!value;
    } catch (e) {
        return false;
    }
}

/**
 * Tests if a value is `boolean`
 * @param {any} value
 * @returns {boolean}
 */
export function isBoolean(value) {
    return value === 'true' || value === 'false';
}

/**
 * Parses a value to `boolean`
 * @param {any} value
 * @returns {boolean}
 */
export function parseBoolean(value) {
    return value === 'true';
}

/**
 * Tests if a value is of type `string`
 * @param {any} value
 * @returns {boolean}
 */
export function isString(value) {
    return (
        typeof value === 'string' ||
        (!!value && typeof value === 'object' && Object.prototype.toString.call(value) === '[object String]')
    );
}

/**
 * Tests if a value is of type `number`
 * @param {any} value
 * @returns {boolean}
 */
export function isNumber(value) {
    return new RegExp('^-?(0|0\\.\\d+|[1-9]\\d*(\\.\\d+)?)$').test(value);
}

/**
 * Tests if a value is of type `NaN`
 * @param {any} value
 * @returns {boolean}
 */
export function isNaN(value) {
    return Number.isNaN(value);
}

/**
 * Compare two values (deep). It compares primitive or complex values with JSON stringify.
 * @param {any} valueA
 * @param {any} valueB
 * @returns {boolean}
 */
export function deepEquals(valueA, valueB) {
    return JSON.stringify(valueA) === JSON.stringify(valueB);
}

/**
 * Parses an attribute value that comes in as a `string` to its corresponding type
 * @param {string} value
 * @param {PropertyOptions} options
 * @returns {string | number | boolean | object | array}
 */
export function parseAttribute(value, options = {}) {
    if (options.parse === false || !isString(value)) {
        // no-op
        return value;
    }
    if (typeof options.parse === 'function') {
        // custom parse fn
        return options.parse(value);
    }

    // default parse
    let parsedValue = value;

    if (isJSON(value)) parsedValue = JSON.parse(value);
    else if (isBoolean(value)) parsedValue = parseBoolean(value);
    else if (isNumber(value)) parsedValue = parseFloat(value);

    return parsedValue;
}

/**
 * Replaces dashed-expression (i.e. some-value) to a camel-cased expression (i.e. someValue)
 * @param {string} string
 * @returns {string}
 */
export function dashToCamel(string) {
    if (string.indexOf('-') === -1) return string;

    return string.replace(/-[a-z]/g, (matches) => matches[1].toUpperCase());
}

/**
 * Replaces camel-cased expression (i.e. someValue) to a dashed-expression (i.e. some-value)
 * @param {string} string
 * @returns {string}
 */
export function camelToDash(string) {
    return string.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Decodes an attribute.
 * @param {string} attribute
 * @returns {string}
 */
export function decodeAttribute(attribute) {
    return `${attribute}`
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}

/**
 * Encodes an attribute.
 * @param {string} attribute
 * @returns {string}
 */
export function encodeAttribute(attribute) {
    return (
        `${attribute}`
            // .replace(/'/g, '&apos;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\r\n/g, '\n')
            .replace(/[\r\n]/g, '\n')
    );
}
