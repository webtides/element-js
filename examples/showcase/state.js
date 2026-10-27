/**
 * Showcase: state. Reactive properties and attributes, a shared Store, watchers, computed properties and the
 * lifecycle hooks. One element per docs chapter, see docs/features and docs/concepts/lifecycle.md.
 */
import { BaseElement, TemplateElement, Store, defineElement, html } from '../../index.js';

/* ---------- properties and attributes ---------- */

class ShowcaseProperties extends TemplateElement {
    constructor() {
        // count is written back to the attribute, the other properties only read their attribute on connect
        super({ propertyOptions: { count: { reflect: true } } });
    }

    properties() {
        return { name: 'John', count: 1, enabled: false, tags: ['one', 'two'], config: { theme: 'dark' } };
    }

    template() {
        return html`
            <dl class="grid grid-cols-[auto_1fr] gap-x-4 text-sm">
                <dt>name</dt>
                <dd>${this.name} <small class="text-gray-500">${typeof this.name}</small></dd>
                <dt>count</dt>
                <dd>
                    ${this.count}
                    <small class="text-gray-500"
                        >${typeof this.count}, attribute count="${this.getAttribute('count')}"</small
                    >
                </dd>
                <dt>enabled</dt>
                <dd>${this.enabled} <small class="text-gray-500">${typeof this.enabled}</small></dd>
                <dt>tags</dt>
                <dd>${this.tags.join(', ')} <small class="text-gray-500">array of ${this.tags.length}</small></dd>
                <dt>config.theme</dt>
                <dd>${this.config.theme} <small class="text-gray-500">object</small></dd>
            </dl>
            <div class="flex flex-wrap gap-2 mt-2">
                <input
                    class="border px-2"
                    .value="${this.name}"
                    @input="${(event) => (this.name = event.target.value)}"
                />
                <button type="button" class="btn" @click="${() => this.count++}">count + 1</button>
                <button type="button" class="btn" @click="${() => (this.enabled = !this.enabled)}">
                    toggle enabled
                </button>
                <button
                    type="button"
                    class="btn"
                    @click="${() => (this.tags = [...this.tags, `tag ${this.tags.length + 1}`])}"
                >
                    add tag
                </button>
            </div>
        `;
    }
}
defineElement('showcase-properties', ShowcaseProperties);

/* ---------- store ---------- */

// one instance, shared by every element that lists it in properties()
const sharedStore = new Store({ count: 0 });

class ShowcaseStore extends TemplateElement {
    properties() {
        return { label: 'A', store: sharedStore };
    }

    template() {
        return html`
            <button type="button" class="btn" @click="${() => this.store.count++}">
                ${this.label}: shared count ${this.store.count}
            </button>
        `;
    }
}
defineElement('showcase-store', ShowcaseStore);

/* ---------- watch and computed ---------- */

class ShowcaseWatch extends TemplateElement {
    properties() {
        return { first: 'Ada', last: 'Lovelace', changes: [] };
    }

    // a getter is a computed property, it is evaluated on every render
    get fullName() {
        return `${this.first} ${this.last}`;
    }

    watch() {
        return {
            first: (newValue, oldValue) => this.record('first', newValue, oldValue),
            last: (newValue, oldValue) => this.record('last', newValue, oldValue),
        };
    }

    record(property, newValue, oldValue) {
        // a new array, a push() into the old one would not be seen as a change
        this.changes = [...this.changes, `${property}: "${oldValue}" → "${newValue}"`];
    }

    template() {
        return html`
            <div class="flex flex-wrap gap-2">
                <input
                    class="border px-2"
                    .value="${this.first}"
                    @input="${(event) => (this.first = event.target.value)}"
                />
                <input
                    class="border px-2"
                    .value="${this.last}"
                    @input="${(event) => (this.last = event.target.value)}"
                />
            </div>
            <p class="mt-2">computed fullName: <b>${this.fullName}</b></p>
            <ol class="list-decimal ml-6 text-sm text-gray-600">
                ${this.changes.slice(-5).map((change) => html`<li>${change}</li>`)}
            </ol>
        `;
    }
}
defineElement('showcase-watch', ShowcaseWatch);

/* ---------- lifecycle ---------- */

class ShowcaseLifecycle extends TemplateElement {
    /** the last hook that ran, read by the host after it removed the element */
    lastHook = '';

    properties() {
        return { tick: 0 };
    }

    connected() {
        this.hook('connected');
    }

    beforeUpdate() {
        this.hook('beforeUpdate');
    }

    afterUpdate() {
        this.hook('afterUpdate');
    }

    disconnected() {
        this.hook('disconnected');
    }

    hook(name) {
        this.lastHook = name;
        this.dispatch('hook', name);
    }

    template() {
        return html`<button type="button" class="btn" @click="${() => this.tick++}">tick ${this.tick}</button>`;
    }
}
defineElement('showcase-lifecycle', ShowcaseLifecycle);

/** A renderless host: listens to the hooks of its child, removes and re-adds it. */
class ShowcaseLifecycleHost extends BaseElement {
    /** @type {ShowcaseLifecycle | undefined} the child while it is detached */
    detached;

    events() {
        return {
            this: { hook: (event) => this.log(event.detail) },
            '[data-toggle]': { click: () => this.toggle() },
        };
    }

    toggle() {
        if (this.detached) {
            this.$refs.slot.append(this.detached);
            this.detached = undefined;
        } else {
            this.detached = this.$refs.element;
            this.detached.remove();
            // a detached element cannot dispatch to its host, so the host reads the hook itself
            this.log(`${this.detached.lastHook} (read by the host, the element is detached)`);
        }
    }

    log(text) {
        this.$refs.log.textContent += `${text}\n`;
    }
}
defineElement('showcase-lifecycle-host', ShowcaseLifecycleHost);
