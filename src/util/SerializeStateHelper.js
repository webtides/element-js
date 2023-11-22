import { Store } from './Store.js';

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

export function setSerializedState(uuid, state) {
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

export function getSerializedState(uuid) {
	initGlobalStateObject();

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
