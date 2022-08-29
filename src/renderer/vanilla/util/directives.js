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
 * @param {TemplateLiteral | string} trueCase
 * @param {TemplateLiteral | string} [falseCase]
 * @returns {TemplateLiteral | string}
 */
const when = (condition, trueCase, falseCase) => {
	return condition ? trueCase : falseCase;
};

/**
 * Chooses and evaluates a template part from a map of cases based on matching the given value to a case.
 * @param {string} value
 * @param {Object.<string, TemplateLiteral | string>} cases
 * @param {TemplateLiteral | string} [defaultCase]
 * @returns {TemplateLiteral | string}
 */
const choose = (value, cases, defaultCase) => {
	return cases[value] || defaultCase;
};

// TODO: move unsafeHTML and spreadAttributes here...

export { classMap, styleMap, when, choose };
