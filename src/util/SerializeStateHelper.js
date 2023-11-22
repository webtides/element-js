import { Store } from './Store.js';

let globalElementJsState;
export function setSerializedState(uuid, state) {
	if (!globalElementJsState) {
		globalElementJsState = Array.from(globalThis.document.scripts).find(
			(script) => script.type === 'element-js/json',
		);
	}

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

export function getSerializedState(uuid) {
	if (!globalElementJsState) {
		globalElementJsState = Array.from(globalThis.document.scripts).find(
			(script) => script.type === 'element-js/json',
		);
	}

	const unresolvedState = JSON.parse(globalElementJsState.textContent);
	const currentState = JSON.parse(globalElementJsState.textContent, (key, value) => {
		if (typeof value === 'string' && value.startsWith('Store/')) {
			const [_, storeUuid] = value.split('/');
			const storeState = unresolvedState[storeUuid];
			return Store.createInstance(storeUuid, storeState);
		} else {
			return value;
		}
	});
	return currentState[uuid];
}
