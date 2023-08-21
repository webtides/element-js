import { camelToDash, decodeAttribute, encodeAttribute } from '../util/AttributeParser.js';
import { TemplateResult } from './TemplateResult.js';
import { convertStringToTemplate } from '../util/DOMHelper.js';

/**
 * Maps a list of classes to an element from an object.
 * The keys will become the classes when the value is truthy.
 * @param {Object.<string, string | boolean | number>} map
 * @returns {string} string of classes joined together
 */
const classMap = (map) => {
	const classes = [];
	for (const [key, value] of Object.entries(map)) {
		if (value) classes.push(key);
	}
	return classes.join(' ');
};

/**
 * Maps a list of styles to an element from an object.
 * The keys will become the properties and the values will become the values.
 * @param {Object.<string, string | undefined | null>} map
 * @returns {string} string of styles joined together
 */
const styleMap = (map) => {
	const styles = [];
	for (const [key, value] of Object.entries(map)) {
		if (value) styles.push(`${key}:${value};`);
	}
	return styles.join(' ');
};

/**
 * Renders one of two template parts based on a condition.
 * @param {boolean} condition
 * @param {TemplateResult | string} trueCase
 * @param {TemplateResult | string} [falseCase]
 * @returns {TemplateResult | string}
 */
const when = (condition, trueCase, falseCase) => {
	return condition ? trueCase : falseCase;
};

/**
 * Chooses and evaluates a template part from a map of cases based on matching the given value to a case.
 * @param {string} value
 * @param {Object.<string, TemplateResult | string>} cases
 * @param {TemplateResult | string} [defaultCase]
 * @returns {TemplateResult | string}
 */
const choose = (value, cases, defaultCase) => {
	return cases[value] || defaultCase;
};

/**
 * Renders a given string as HTML instead of text
 * @param {string} string
 * @returns {function(): DocumentFragment | string}
 */
const unsafeHTML = (string) => {
	const fragment = convertStringToTemplate(string);
	if (typeof fragment === 'string') return () => fragment;
	const importedFragment = globalThis.document?.importNode(fragment, true);
	return () => importedFragment;
};

/**
 * Renders multiple attributes as key="value" pairs from a map of attributes
 * @param {Object.<string, any>} attributes
 * @returns {function(): string}
 */
const spreadAttributes = (attributes) => {
	// TODO: this can only work in SSR, for CSR we should make a Directive class
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

export { classMap, styleMap, when, choose, unsafeHTML, spreadAttributes };
