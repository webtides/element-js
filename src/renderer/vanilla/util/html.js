import { camelToDash, decodeAttribute, encodeAttribute } from '../../../util/AttributeParser';
import { TemplateResult } from './TemplateResult';

/**
 * @param {TemplateStringsArray} strings
 * @param {any[]} values
 * @return {TemplateResult}
 */
const html = function (strings, ...values) {
	return new TemplateResult(strings, ...values);
};

/**
 * @param {String} string
 * @return {function(): string}
 */
const unsafeHTML = (string) => {
	return () => `${decodeAttribute(string)}`;
};

/**
 * @param {Object} attributes
 * @return {function(): string}
 */
const spreadAttributes = (attributes) => {
	return () => {
		return Object.keys(attributes)
			.map((key) => {
				let value = attributes[key];
				return `${camelToDash(key)}='${encodeAttribute(
					typeof value !== 'string' ? JSON.stringify(value) : value,
				)}'`;
			})
			.join(' ');
	};
};

export { html, unsafeHTML, spreadAttributes };
