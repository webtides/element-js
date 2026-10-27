/**
 * Showcase: composition. Context protocol, public methods with refs, events and a renderless element. One element
 * per docs chapter, see docs/features.
 */
import { BaseElement, TemplateElement, Store, defineElement, html, classMap } from '../../index.js';

/* ---------- context protocol ---------- */

/**
 * A plain value is handed over when the consumer connects. A Store is handed over by reference, so changes in the
 * store render every consumer that holds it.
 */
class ShowcaseProvider extends TemplateElement {
    properties() {
        return { theme: 'light', settings: new Store({ theme: 'light' }) };
    }

    provideProperties() {
        return { theme: this.theme, settings: this.settings };
    }

    template() {
        return html`
            <label>
                theme
                <select
                    class="border px-2"
                    @change="${(event) => {
                        this.theme = event.target.value;
                        this.settings.theme = event.target.value;
                    }}"
                >
                    <option value="light" ?selected="${this.theme === 'light'}">light</option>
                    <option value="dark" ?selected="${this.theme === 'dark'}">dark</option>
                </select>
            </label>
            <div class="mt-2 pl-4 border-l-2 flex flex-col gap-1">
                <showcase-consumer></showcase-consumer>
                <showcase-manual-consumer></showcase-manual-consumer>
            </div>
        `;
    }
}
defineElement('showcase-provider', ShowcaseProvider);

/** Injected properties are reactive properties of the consumer. */
class ShowcaseConsumer extends TemplateElement {
    injectProperties() {
        return { theme: 'not provided', settings: {} };
    }

    template() {
        return html`
            <p>
                injected value <b>${this.theme}</b> (handed over on connect), injected store
                <b>${this.settings.theme}</b> (follows the select)
            </p>
        `;
    }
}
defineElement('showcase-consumer', ShowcaseConsumer);

/** A manual request runs once when the element connects, the callback decides what to do with the value. */
class ShowcaseManualConsumer extends TemplateElement {
    properties() {
        return { shouted: '' };
    }

    connected() {
        this.requestContext('theme', (theme) => (this.shouted = theme.toUpperCase()));
    }

    template() {
        return html`<p>requested once on connect: <b>${this.shouted}</b></p>`;
    }
}
defineElement('showcase-manual-consumer', ShowcaseManualConsumer);

/* ---------- methods and refs ---------- */

class ShowcaseModal extends TemplateElement {
    properties() {
        return { visible: false };
    }

    show() {
        this.visible = true;
    }

    hide() {
        this.visible = false;
    }

    template() {
        return html`
            <div class="${classMap({ hidden: !this.visible })} mt-2 p-4 border rounded bg-yellow-50">
                opened through the public method <code>show()</code>
                <button type="button" class="btn ml-2" @click="${() => this.hide()}">hide()</button>
            </div>
        `;
    }
}
defineElement('showcase-modal', ShowcaseModal);

/** Renderless: reaches the modal through a ref and calls its method. */
class ShowcaseMethods extends BaseElement {
    events() {
        return {
            '[data-open]': { click: () => this.$refs.modal.show() },
        };
    }
}
defineElement('showcase-methods', ShowcaseMethods);

/* ---------- events ---------- */

class ShowcaseEmitter extends TemplateElement {
    template() {
        return html`
            <button
                type="button"
                class="btn"
                @click="${() => this.dispatch('ping', { at: new Date().toLocaleTimeString() })}"
            >
                dispatch('ping')
            </button>
        `;
    }
}
defineElement('showcase-emitter', ShowcaseEmitter);

class ShowcaseEvents extends TemplateElement {
    properties() {
        return { received: [] };
    }

    events() {
        return {
            // a selector inside the element
            'showcase-emitter': { ping: (event) => this.receive(`ping at ${event.detail.at}`) },
            // the special targets window and document, with listener options
            window: {
                resize: {
                    listener: () => this.receive(`window resize, ${innerWidth}px wide`),
                    options: { passive: true },
                },
            },
        };
    }

    receive(entry) {
        this.received = [...this.received, entry];
    }

    template() {
        return html`
            <showcase-emitter></showcase-emitter>
            <ul class="text-sm text-gray-600 mt-2">
                ${this.received.slice(-5).map((entry) => html`<li>${entry}</li>`)}
            </ul>
        `;
    }
}
defineElement('showcase-events', ShowcaseEvents);

/* ---------- renderless ---------- */

/** Only behaviour, the markup is in the page. The list is a ref, the entries a list ref. */
class ShowcaseDropdown extends BaseElement {
    events() {
        return {
            button: { click: () => this.$refs.list.classList.toggle('hidden') },
            li: {
                click: (event) => {
                    this.$refs.label.textContent = `${event.target.textContent} (1 of ${this.$refs.entries.length})`;
                    this.$refs.list.classList.add('hidden');
                },
            },
        };
    }
}
defineElement('showcase-dropdown', ShowcaseDropdown);
