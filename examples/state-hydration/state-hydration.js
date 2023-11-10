import { TemplateElement, defineElement, html, Store } from '../../index.js';

class CounterStore extends Store {
	properties() {
		return { count: 0 };
	}
}

const sharedStore = new CounterStore();

/**
 * @property {number} count
 * @property {CounterStore} sharedStore
 * @property {CounterStore} internalStore
 */
class CounterElement extends TemplateElement {
	properties() {
		return {
			count: -1,
			sharedStore: sharedStore,
			internalStore: new CounterStore({ count: 1 }),
		};
	}

	events() {
		return {
			button: {
				click: (event) => {
					const property = event.target.dataset.store;
					if (property === 'count') this.count++;
					if (property === 'sharedStore') this.sharedStore.count++;
					if (property === 'internalStore') this.internalStore.count++;
				},
			},
		};
	}

	template() {
		return html`<div class="flex flex-col gap-4 items-center">
			<button class="btn" data-store="count">count: ${this.count}</button>
			<button class="btn" data-store="sharedStore">sharedStore: ${this.sharedStore.count}</button>
			<button class="btn" data-store="internalStore">internalStore: ${this.internalStore.count}</button>
		</div>`;
	}
}

defineElement('counter-element', CounterElement);
