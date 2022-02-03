export function isObjectLike(value) {
	return typeof value == 'object' && value !== null;
}

export function isJSON(str) {
	try {
		return JSON.parse(str) && !!str;
	} catch (e) {
		return false;
	}
}

export function isBoolean(value) {
	return value === 'true' || value === 'false';
}

export function parseBoolean(value) {
	return value === 'true';
}

export function isString(value) {
	return (
		typeof value === 'string' ||
		(!!value && typeof value === 'object' && Object.prototype.toString.call(value) === '[object String]')
	);
}

export function isNumber(value) {
	return new RegExp('^-?(0|0\\.\\d+|[1-9]\\d*(\\.\\d+)?)$').test(value);
}

export function isNaN(value) {
	return Number.isNaN(value);
}

export function parseAttribute(value) {
	if (!isString(value)) {
		return value;
	}

	let parsedValue = value;

	if (isJSON(value)) parsedValue = JSON.parse(value);
	else if (isBoolean(value)) parsedValue = parseBoolean(value);
	else if (isNumber(value)) parsedValue = parseFloat(value);

	return parsedValue;
}

/**
 * Replaces dashed-expression (i.e. some-value) to a camel-cased expression (i.e. someValue)
 * @returns string
 */
export function dashToCamel(string) {
	if (string.indexOf('-') === -1) return string;

	return string.replace(/-[a-z]/g, (matches) => matches[1].toUpperCase());
}

/**
 * Replaces camel-cased expression (i.e. someValue) to a dashed-expression (i.e. some-value)
 * @returns string
 */
export function camelToDash(string) {
	return string.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Decodes an attribute. Can only be encoded with the `encodeAttribute` method which
 * is exported from this file.
 *
 * @param attribute
 * @returns {string}
 */
export function decodeAttribute(attribute) {
	return `${attribute}`
		.replace(/\$lt;/g, '<')
		.replace(/\$gt;/g, '>')
		.replace(/\$quot;/g, '"')
		.replace(/\$apos;/g, "'");
}

/**
 * Encodes an attribute. Can only be decoded with the `decodeAttribute` method which
 * is exported from this file.
 *
 * This does not use the standard way to encode an attribute, as the dom parser
 * that renders the html would understand and automatically decode it. Which results
 * in non sanitized html output.
 *
 * @param attribute
 * @returns {string}
 */
export function encodeAttribute(attribute) {
	return `${attribute}`
		.replace(/'/g, '$apos;')
		.replace(/"/g, '$quot;')
		.replace(/</g, '$lt;')
		.replace(/>/g, '$gt;')
		.replace(/\r\n/g, '\n')
		.replace(/[\r\n]/g, '\n');
}
