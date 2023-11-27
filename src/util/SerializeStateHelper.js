import { Store } from './Store.js';

/**
 * @typedef {Object} SerializableState
 * An interface that classes should implement to enable serialization and deserialization of their state.
 * @property {string} _serializationKey - a unique key to be used for serialization.
 * @property {object} toJSON - Function to retrieve the state for serialization.
 * @property {object} fromJSON - Function to set the state during deserialization.
 */

// TODO: is it ok to expose this like this? Or should we wrap the cache in helper methods also?
/** @type {Map<string, SerializableState>} */
export const serializableObjectsCache = new Map();

let globalElementJsState;
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

export function serializeState(serializableObject) {
	if (!serializableObject._serializationKey && !serializableObject.toJSON) {
		throw new Error('serializableObject does not implement the Serializable interface');
	}
	setSerializedState(serializableObject._serializationKey, serializableObject.toJSON());
}

export function deserializeState(serializableObject, serializedState) {
	if (!serializableObject._serializationKey && !serializableObject.fromJSON) {
		throw new Error('serializableObject does not implement the Serializable interface');
	}
	// TODO: I'm not sure if I like "fromJSON" so much...
	serializableObject.fromJSON(serializedState || getSerializedState(serializableObject._serializationKey));
}

function setSerializedState(uuid, state) {
	initGlobalStateObject();

	const currentState = JSON.parse(globalElementJsState.textContent);
	currentState[uuid] = state;
	globalElementJsState.textContent = JSON.stringify(currentState, (key, value) => {
		if (value instanceof Store) {
			return 'Store/' + value._uuid;
		} else {
			return value;
		}
	});
}

function getSerializedState(uuid) {
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
	return currentState[uuid];
}

export function hasSerializedState(uuid) {
	initGlobalStateObject();

	const serializedState = JSON.parse(globalElementJsState.textContent);
	return serializedState.hasOwnProperty(uuid);
}
