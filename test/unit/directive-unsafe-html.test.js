/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { html, render } from '../../src/TemplateElement.js';
import { unsafeHTML } from '../../src/dom-parts/directives.js';
import { DOCUMENT_FRAGMENT_NODE, ELEMENT_NODE } from '../../src/util/DOMHelper.js';
import { stripCommentMarkers, stripWhitespace } from '../util/testing-helpers.js';

describe('unsafeHTML directive', () => {
    it('returns a function', async () => {
        const unsafeContent = unsafeHTML(`<strong>Unsafe HTML</strong>`);
        assert.equal(typeof unsafeContent, 'function');
    });

    it('returns a string as a result of the function in SSR', async () => {
        const originalDomParser = globalThis.DOMParser;
        globalThis.DOMParser = undefined;

        const templateResult = html`<div>${unsafeHTML(`<strong>Unsafe HTML</strong>`)}</div>`;
        const unsafeContent = templateResult.toString();
        assert.equal(typeof unsafeContent, 'string');
        assert.equal(stripCommentMarkers(unsafeContent), '<div><strong>Unsafe HTML</strong></div>');

        globalThis.DOMParser = originalDomParser;
    });

    it('returns a list with one Node as a result of the function in CSR with only one node in it', async () => {
        const unsafeContent = unsafeHTML(`<strong>Unsafe HTML</strong>`);
        const nodes = unsafeContent();
        assert.equal(Array.isArray(nodes), true);
        assert.equal(nodes.length, 1);
        assert.equal(nodes[0].nodeType, ELEMENT_NODE);
    });

    it('returns a list of Nodes as a result of the function in CSR with multiple nodes in it', async () => {
        const unsafeContent = unsafeHTML(`<strong>Unsafe HTML</strong><p>Unsafe HTML 2</p>`);
        const nodes = unsafeContent();
        assert.equal(nodes.length, 2);
    });
});
