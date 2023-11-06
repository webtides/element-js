import { camelToDash, decodeAttribute, encodeAttribute } from '../util/AttributeParser.js';
import { TemplateResult } from './TemplateResult.js';
import { convertStringToHTML, convertStringToTemplate } from '../util/DOMHelper.js';
import { defineDirective, Directive } from '../util/Directive.js';

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
 * @returns {function(): Node | string}
 */
const unsafeHTML = (string) => {
	if (!globalThis.DOMParser) return () => string;
	const node = convertStringToHTML(string).firstChild;
	const importedNode = globalThis.document?.importNode(node, true);
	return () => importedNode;
};

/**
 * Renders multiple attributes as key="value" pairs from a map of attributes
 */
export class SpreadAttributesDirective extends Directive {
	/**
	 * @param {Object.<string, any>} attributes
	 */
	update(attributes) {
		// TODO: what if the attribute was already there..?!
		// TODO: what if the attribute was there from a previous render/update, but not anymore?!
		for (const name of Object.keys(attributes)) {
			const value = attributes[name];
			this.node.setAttribute(
				camelToDash(name),
				encodeAttribute(typeof value !== 'string' ? JSON.stringify(value) : value),
			);
		}
	}

	/**
	 * @param {Object.<string, any>} attributes
	 * @returns {string}
	 */
	stringify(attributes) {
		return Object.keys(attributes)
			.map((name) => {
				let value = attributes[name];
				return `${camelToDash(name)}='${encodeAttribute(
					typeof value !== 'string' ? JSON.stringify(value) : value,
				)}'`;
			})
			.join(' ');
	}
}

/**
 * Renders multiple attributes as key="value" pairs from a map of attributes
 * @param {Object.<string, any>} attributes
 */
const spreadAttributes = defineDirective(SpreadAttributesDirective);

export { classMap, styleMap, when, choose, unsafeHTML, spreadAttributes };