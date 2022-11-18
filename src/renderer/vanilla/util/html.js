import { camelToDash, decodeAttribute, encodeAttribute } from '../../../util/AttributeParser';
import { TemplateResult } from './dom-parts';

const html = function (strings, ...values) {
	return new TemplateResult(strings, ...values);
};

const unsafeHTML = (string) => {
	return () => `${decodeAttribute(string)}`;
};

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
