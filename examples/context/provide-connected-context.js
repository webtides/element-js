import { TemplateElement, defineElement, html } from '../../index.js';
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

class ProvideConnectedContext extends TemplateElement {
    // reactive attributes/properties
    constructor() {
        super({ shadowRender: true });
    }

    properties() {
        return {
            counterStore: null,
        };
    }
    connected() {
        this.counterStore = new CounterStore({ count: 8 });
    }

    provideProperties() {
        return { counterStore: this.counterStore };
    }
    template() {
        return html`
            <div>Provider: ${this.counterStore?.count ?? 'null'}</div>
            <slot></slot>
        `;
    }
}
defineElement('provide-connected-context', ProvideConnectedContext);
