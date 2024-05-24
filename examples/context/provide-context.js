import { TemplateElement, defineElement, html } from '../../src/renderer/vanilla';
import { Store } from '../../src/util/Store.js';

class CounterStore extends Store {
    constructor(...args) {
        super(...args);
        globalThis.setInterval(() => {
            this.count++;
        }, 1000);
    }

    properties() {
        return { count: 0 };
    }
}

class ProvideContext extends TemplateElement {
    // reactive attributes/properties
    constructor() {
        super({ shadowRender: true });
    }
    properties() {
        return {
            counterStore: new CounterStore({ count: 1 }),
        };
    }
    provideProperties() {
        return { counterStore: this.counterStore };
    }
    template() {
        return html`
            <div>Provider: ${this.counterStore.count}</div>
            <slot></slot>
        `;
    }
}
defineElement('provide-context', ProvideContext);
