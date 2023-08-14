import { TemplateResult } from './TemplateResult';

/**
 * @param {TemplateStringsArray} strings
 * @param {any[]} values
 * @return {TemplateResult}
 */
const html = function (strings, ...values) {
	return new TemplateResult(strings, ...values);
};

export { html };
