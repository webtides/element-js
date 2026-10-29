import { fixture, assert, defineCE, nextFrame } from '@open-wc/testing';
import { html, TemplateElement } from '../../src/TemplateElement.js';

const color = 'rgb(1, 2, 3)';
const globalColor = 'rgb(4, 5, 6)';
const globalColor2 = 'rgb(7, 8, 9)';

const shadowTag = defineCE(
    class extends TemplateElement {
        constructor() {
            super({ shadowRender: true });
        }

        template() {
            return html` <div>client side shadow root content</div> `;
        }
    },
);

/**
 * The markup the server delivers for an element that renders in shadow DOM.
 * @param {string} tag
 * @param {string} markup - what toString() of the element's template wrote
 * @return {string}
 */
const serverMarkup = (tag, markup) => `<${tag}><template shadowrootmode="open">${markup}</template></${tag}>`;

/**
 * Parses markup with a declarative shadow root into a fixture. innerHTML keeps a `<template shadowrootmode>` as a
 * template element, the parser and setHTMLUnsafe() attach the shadow root.
 * @param {string} markup
 * @return {Promise<Element>} the first element of the markup, connected and rendered
 */
const declarativeFixture = async (markup) => {
    const wrapper = await fixture('<div></div>');
    wrapper.setHTMLUnsafe(markup);
    await nextFrame();
    return wrapper.firstElementChild;
};

describe(`declarative shadow dom template rendering for`, () => {
    it('renders the template in shadow dom on the client if no declarative template is available', async () => {
        const el = await fixture(`<${shadowTag}></${shadowTag}>`);
        assert.isNotNull(el.shadowRoot);
        assert.shadowDom.equal(el, '<div>client side shadow root content</div>');
    });

    it('hydrates the shadow root from the server if a template element with shadowrootmode was provided', async () => {
        const wrapper = await fixture('<div></div>');
        // the element is defined after parsing, so the server rendered node is known before the upgrade renders
        wrapper.setHTMLUnsafe(serverMarkup('dsd-hydrated-el', html`<div>shadow root content</div>`.toString()));
        const el = wrapper.firstElementChild;
        const serverDiv = el.shadowRoot.querySelector('div');
        customElements.define(
            'dsd-hydrated-el',
            class extends TemplateElement {
                constructor() {
                    super({ shadowRender: true });
                }

                template() {
                    return html`<div>shadow root content</div>`;
                }
            },
        );
        await nextFrame();

        assert.strictEqual(el.shadowRoot.querySelector('div'), serverDiv);
        assert.shadowDom.equal(el, '<div>shadow root content</div>');
    });

    it('adopts the element styles into a declarative shadow root', async () => {
        const tag = defineCE(
            class extends TemplateElement {
                constructor() {
                    super({ shadowRender: true, adoptGlobalStyles: false });
                }

                styles() {
                    return [`div { color: ${color}; }`];
                }

                template() {
                    return html`<div>styled</div>`;
                }
            },
        );
        const el = await declarativeFixture(serverMarkup(tag, html`<div>styled</div>`.toString()));

        assert.equal(el.shadowRoot.adoptedStyleSheets.length, 1);
        assert.equal(getComputedStyle(el.shadowRoot.querySelector('div')).color, color);
    });

    it('adopts global styles into a declarative shadow root and follows global style changes', async () => {
        const style = document.createElement('style');
        style.textContent = `p { color: ${globalColor}; }`;
        document.head.appendChild(style);
        const tag = defineCE(
            class extends TemplateElement {
                constructor() {
                    super({ shadowRender: true });
                }

                template() {
                    return html`<p>global</p>`;
                }
            },
        );
        const el = await declarativeFixture(serverMarkup(tag, html`<p>global</p>`.toString()));
        const p = el.shadowRoot.querySelector('p');
        assert.equal(getComputedStyle(p).color, globalColor);

        const style2 = document.createElement('style');
        style2.textContent = `p { color: ${globalColor2}; }`;
        document.head.appendChild(style2);
        await nextFrame();
        assert.equal(getComputedStyle(p).color, globalColor2);

        style.remove();
        style2.remove();
    });
});
