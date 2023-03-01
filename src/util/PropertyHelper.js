import { camelToDash } from './AttributeParser';

/**
 * Helper Function to inform to call the callbacks for  watched properties and dispatch change events
 *
 * @param context is the elements instance
 * @param property property that changes
 * @param newValue
 * @param oldValue
 */
export const informWatchedPropertiesAndDispatchChangeEvent = (context, property, newValue, oldValue) => {
	// notify watched properties (after update())
	const watch = context.watch();
	if (property in watch) {
		watch[property](newValue, oldValue);
	}

	// dispatch change event
	if (
		property in context._options['propertyOptions'] &&
		context._options['propertyOptions'][property]['notify'] === true
	) {
		context.dispatch(`${camelToDash(property)}-changed`, newValue, true);
	}
};
