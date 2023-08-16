/**
 * Retrieves a translated key from a dictionary on the window object
 * Example: ${i18n('CustomElement.buttonLabel', 'Label')}
 * @param {string} key - to be translated
 * @param {string} fallback - to be used if key is not defined
 * @return {string} - String of the translated key or fallback or original key
 */
export function i18n(key, fallback) {
	try {
		const translations = window.elementjs.i18n();
		if (translations[key] === undefined) {
			throw 'Translation Missing';
		}

		return translations[key];
	} catch (err) {
		if (fallback) return fallback;
		else return key;
	}
}
