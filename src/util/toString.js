/**
 * Little wrapper function for JSON.stringify() to easily convert objects and arrays to strings
 * to be able to set them as attributes on custom elements
 * @param {object | array} value - to be stringified
 * @return {string}
 */
export function toString(value) {
    try {
        return JSON.stringify(value);
    } catch (e) {
        return '';
    }
}
