import { Store } from './Store.js';

/**
 * @typedef {Object} Serializable
 * An interface that classes should implement to enable serialization and deserialization of their state.
 * @property {string} _serializationKey - a unique key to be used for serialization.
 * @property {object} toJSON - Function to retrieve the state for serialization.
 * @property {object} fromJSON - Function to set the state during deserialization.
 */

// TODO: is it ok to expose this like this? Or should we wrap the cache in helper methods also?
/** @type {Map<string, Serializable>} */
export const serializableObjectsCache = new Map();

/** @type {HTMLScriptElement} */
let globalElementJsState;

/**
 * Initializes the global script element that holds the state for all `Serializable` objects.
 */
function initGlobalStateObject() {
	if (!globalElementJsState) {
		globalElementJsState = Array.from(globalThis.document.scripts).find(
			(script) => script.type === 'element-js/json',
		);
		if (!globalElementJsState) {
			const script = document.createElement('script');
			script.setAttribute('type', 'element-js/json');
			document.body.appendChild(script);
			globalElementJsState = script;
		}
	}
}

/**
 * Takes an object that implements the `Serializable` interface and serializes its state.
 * @param {Serializable} serializableObject
 */
export function serializeState(serializableObject) {
	if (!serializableObject._serializationKey && !serializableObject.toJSON) {
		throw new Error('serializableObject does not implement the Serializable interface');
	}

	initGlobalStateObject();

	const currentState = JSON.parse(globalElementJsState.textContent);
	currentState[serializableObject._serializationKey] = serializableObject.toJSON();
	globalElementJsState.textContent = JSON.stringify(currentState, (key, value) => {
		if (value instanceof Store) {
			return 'Store/' + value._serializationKey;
		} else {
			return value;
		}
	});
}

/**
 * Takes an object that implements the `Serializable` interface and deserializes its state and restores the object.
 * @param {Serializable} serializableObject
 * @param {{[string: any]: *}} [serializedState]
 */
export function deserializeState(serializableObject, serializedState) {
	if (!serializableObject._serializationKey && !serializableObject.fromJSON) {
		throw new Error('serializableObject does not implement the Serializable interface');
	}

	if (serializedState) {
		// TODO: I'm not sure if I like "fromJSON" so much...
		serializableObject.fromJSON(serializedState);
		return;
	}

	initGlobalStateObject();

	const unresolvedState = JSON.parse(globalElementJsState.textContent);
	const currentState = JSON.parse(globalElementJsState.textContent, (key, value) => {
		if (typeof value === 'string' && value.startsWith('Store/')) {
			const [_, storeUuid] = value.split('/');
			const serializedState = unresolvedState[storeUuid];
			return new Store(serializedState, { key: storeUuid, serializedState });
		} else {
			return value;
		}
	});

	// TODO: I'm not sure if I like "fromJSON" so much...
	serializableObject.fromJSON(currentState[serializableObject._serializationKey]);
}

/**
 * Checks if a serialized state is available for a given key.
 * @param key
 * @return {boolean}
 */
export function hasSerializedState(key) {
	initGlobalStateObject();

	const serializedState = JSON.parse(globalElementJsState.textContent);
	return serializedState.hasOwnProperty(key);
}
