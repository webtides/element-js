import { BaseElement } from '../BaseElement';
import { Store } from './Store';
import { TemplateElement } from '../TemplateElement';

export function isBaseElement(node) {
	return node instanceof BaseElement;
}
export function isTemplateElement(node) {
	return node instanceof TemplateElement;
}
export function isStore(store) {
	return store instanceof Store;
}

export function isShadowRoot(root) {
	return root instanceof ShadowRoot;
}
