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
 * @param {TemplatePart} trueCase
 * @param {TemplatePart} falseCase
 * @returns {TemplatePart}
 */
const when = (condition, trueCase, falseCase) => {
	return condition ? trueCase : falseCase;
};

/**
 * Chooses and evaluates a template part from a map of cases based on matching the given value to a case.
 * @param {string} value
 * @param {Object.<string, TemplatePart>} cases
 * @param {TemplatePart} defaultCase
 * @returns {TemplatePart}
 */
const choose = (value, cases, defaultCase) => {
	return cases[value] || defaultCase;
};

/**
 * Returns an iterable containing the result of calling callback(item) on each item in the list.
 * @param items
 * @param callback
 * @returns {TemplatePart}
 */
const map = (items, callback) => {
	return items.map(callback);
};

export { classMap, styleMap, when, choose, map };
