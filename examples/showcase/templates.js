/**
 * Showcase: templates. Conditionals, lists, nested template functions, the built-in directives and a custom
 * directive, see docs/features/templates.md.
 */
import {
    TemplateElement,
    Directive,
    defineDirective,
    defineElement,
    html,
    classMap,
    styleMap,
    when,
    choose,
    unsafeHTML,
    spreadAttributes,
    optionalAttribute,
} from '../../index.js';

/** A custom directive on an element: update() runs in the browser, stringify() is what the server renders. */
class HighlightDirective extends Directive {
    update(active) {
        this.node.toggleAttribute('data-highlight', active);
    }

    stringify(active) {
        return active ? 'data-highlight' : '';
    }
}
const highlight = defineDirective(HighlightDirective);

class ShowcaseTemplates extends TemplateElement {
    properties() {
        return {
            tab: 'home',
            loggedIn: false,
            items: ['one', 'two', 'three'],
            color: 'teal',
            raw: '<em>parsed</em> as HTML',
        };
    }

    template() {
        return html`
            <nav class="flex gap-2">
                ${['home', 'about', 'contact'].map(
                    (tab) => html`
                        <button
                            type="button"
                            class="btn ${classMap({ 'opacity-50': this.tab !== tab })}"
                            @click="${() => (this.tab = tab)}"
                        >
                            ${tab}
                        </button>
                    `,
                )}
            </nav>
            <section class="mt-2 p-3 border rounded" ${highlight(this.tab === 'about')}>
                ${choose(
                    this.tab,
                    {
                        home: html`<p>home, picked with <code>choose()</code></p>`,
                        about: html`<p>
                            about, the section got <code>data-highlight</code> from the custom directive
                        </p>`,
                    },
                    html`<p>contact, the default case</p>`,
                )}
            </section>
            <p class="mt-2">
                <code>when()</code>: ${when(this.loggedIn, html`<b>logged in</b>`, html`<i>logged out</i>`)}
                <button type="button" class="btn ml-2" @click="${() => (this.loggedIn = !this.loggedIn)}">
                    toggle
                </button>
            </p>
            <ul class="list-disc ml-6 mt-2">
                ${this.items.map((item, index) => this.itemTemplate(item, index))}
            </ul>
            <button
                type="button"
                class="btn mt-1"
                @click="${() => (this.items = [...this.items, `item ${this.items.length + 1}`])}"
            >
                add item
            </button>
            <p class="mt-2" style="${styleMap({ color: this.color, 'font-weight': 'bold' })}">
                <code>styleMap()</code>: ${this.color}
                <button
                    type="button"
                    class="btn ml-2"
                    @click="${() => (this.color = this.color === 'teal' ? 'crimson' : 'teal')}"
                >
                    switch
                </button>
            </p>
            <p class="mt-2">escaped: ${this.raw}</p>
            <p><code>unsafeHTML()</code>: ${unsafeHTML(this.raw)}</p>
            <p class="mt-2" ${spreadAttributes({ title: 'from spreadAttributes', dataCount: this.items.length })}>
                <code>spreadAttributes()</code>: hover for the title, data-count="${this.items.length}"
            </p>
            <input
                class="border px-2 mt-2 w-full"
                ${optionalAttribute(!this.loggedIn, 'disabled')}
                placeholder="optionalAttribute(): disabled while logged out"
            />
        `;
    }

    // a nested template function keeps the main template readable
    itemTemplate(item, index) {
        return html`<li>${index + 1}. ${item}</li>`;
    }
}
defineElement('showcase-templates', ShowcaseTemplates);
