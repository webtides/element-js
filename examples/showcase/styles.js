/**
 * Showcase: styles and shadow DOM. Element styles in shadow and light DOM, slots, a CSS custom property, global
 * styles adopted into a shadow root and a declarative shadow root, see docs/features/styles.md and
 * docs/features/global-styles.md.
 */
import { TemplateElement, defineElement, html } from '../../index.js';

/* ---------- shadow DOM, slots, element styles ---------- */

class ShowcaseCard extends TemplateElement {
    constructor() {
        super({ shadowRender: true, adoptGlobalStyles: false });
    }

    styles() {
        return [
            `
            /* box-shadow, not border: the page resets border-width on every element, which also hits the host */
            :host { display: block; border-radius: 0.5rem; overflow: hidden; box-shadow: 0 0 0 2px var(--card-accent, gray); }
            header { background: var(--card-accent, gray); color: white; padding: 0.5rem 1rem; }
            .content { padding: 1rem; }
            footer { padding: 0.5rem 1rem; border-top: 1px solid var(--card-accent, gray); font-size: 0.875rem; }
            `,
        ];
    }

    template() {
        return html`
            <header><slot name="header">no header slotted</slot></header>
            <div class="content"><slot></slot></div>
            <footer><slot name="footer">no footer slotted</slot></footer>
        `;
    }
}
defineElement('showcase-card', ShowcaseCard);

/* ---------- light DOM styles ---------- */

class ShowcaseBadge extends TemplateElement {
    styles() {
        // light DOM: the selector carries the tag name, the sheet is not scoped
        return [
            'showcase-badge .badge { background: #1e3a8a; color: white; padding: 0.125rem 0.5rem; border-radius: 9999px; }',
        ];
    }

    template() {
        return html`<span class="badge">light DOM, styled by a styles() sheet with a tag prefixed selector</span>`;
    }
}
defineElement('showcase-badge', ShowcaseBadge);

/* ---------- global styles ---------- */

class ShowcaseGlobalStyles extends TemplateElement {
    constructor() {
        super({ shadowRender: true, adoptGlobalStyles: '#showcase-global-styles' });
    }

    template() {
        return html`<p class="showcase-global">
            adopts #showcase-global-styles from the document into the shadow root
        </p>`;
    }
}
defineElement('showcase-global-styles', ShowcaseGlobalStyles);

class ShowcaseNoGlobalStyles extends TemplateElement {
    constructor() {
        super({ shadowRender: true, adoptGlobalStyles: false });
    }

    template() {
        return html`<p class="showcase-global">adopts nothing, the same markup stays unstyled</p>`;
    }
}
defineElement('showcase-no-global-styles', ShowcaseNoGlobalStyles);

/* ---------- declarative shadow DOM ---------- */

/** The page carries a <template shadowrootmode="open"> with the server rendered template, it is hydrated on connect. */
class ShowcaseDsd extends TemplateElement {
    constructor() {
        super({ shadowRender: true, adoptGlobalStyles: false });
    }

    properties() {
        return { count: 0 };
    }

    styles() {
        // adopted into the declarative shadow root on the first render, the server markup carries no styles
        return ['button { background: #4338ca; color: white; padding: 0.5rem 0.75rem; border-radius: 0.375rem; }'];
    }

    template() {
        // the server markup in the page is the toString() of this template, kept on one line to mirror it
        // prettier-ignore
        return html`<p>server rendered shadow root, count: ${this.count}</p> <button type="button" @click="${() => this.count++}">count + 1</button>`;
    }
}
defineElement('showcase-dsd', ShowcaseDsd);
