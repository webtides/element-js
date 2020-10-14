/**
 * Little wrapper function for JSON.stringify() to easily convert objects and arrays to strings
 * to be able to set them as attributes on custom elements
 * @param value to be stringified
 * @return String of the stringified value
 */
export function toString(value) {
	try {
		return JSON.stringify(value);
	} catch (e) {
		return '';
	}
}
