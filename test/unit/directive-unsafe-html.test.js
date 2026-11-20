/* eslint-disable no-unused-expressions */
import { assert } from '@open-wc/testing';
import { html, render } from '../../src/TemplateElement.js';
import { unsafeHTML } from '../../src/dom-parts/directives.js';
import { stripCommentMarkers } from '../util/testing-helpers.js';

describe('unsafeHTML directive', () => {
    it('marks the string as HTML', async () => {
        const unsafeContent = unsafeHTML(`<strong>Unsafe HTML</strong>`);
        assert.equal(unsafeContent.string, '<strong>Unsafe HTML</strong>');
        assert.isTrue(unsafeContent.__unsafeHTML);
    });

    it('writes the string as is in toString()', async () => {
        const templateResult = html`<div>${unsafeHTML(`<strong>Unsafe HTML</strong>`)}</div>`;
        assert.equal(stripCommentMarkers(templateResult.toString()), '<div><strong>Unsafe HTML</strong></div>');
    });

    it('renders all nodes of the string', async () => {
        const el = document.createElement('div');
        render(html`<div>${unsafeHTML(`<strong>Unsafe HTML</strong><p>Unsafe HTML 2</p>`)}</div>`, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div><strong>Unsafe HTML</strong><p>Unsafe HTML 2</p></div>');
    });

    it('parses the same HTML once and leaves the rendered nodes alone on the next render', async () => {
        const OriginalDOMParser = globalThis.DOMParser;
        let parses = 0;
        globalThis.DOMParser = class extends OriginalDOMParser {
            parseFromString(...args) {
                parses++;
                return super.parseFromString(...args);
            }
        };
        try {
            const el = document.createElement('div');
            const template = (content) => html`<div>${unsafeHTML(content)}</div>`;
            render(template('<strong>one</strong>'), el);
            const strong = el.querySelector('strong');
            render(template('<strong>one</strong>'), el);
            assert.equal(parses, 1, 'the same string is not parsed again');
            assert.equal(el.querySelector('strong'), strong, 'the rendered node stays');
            render(template('<strong>two</strong>'), el);
            assert.equal(parses, 2, 'a new string is parsed');
            assert.equal(stripCommentMarkers(el.innerHTML), '<div><strong>two</strong></div>');
        } finally {
            globalThis.DOMParser = OriginalDOMParser;
        }
    });
});
