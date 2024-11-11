/* eslint-disable no-unused-expressions */
import { assert } from '@open-wc/testing';
import { optionalAttribute, OptionalAttributeDirective, spreadAttributes } from '../../src/dom-parts/directives.js';
import { html } from '../../src/dom-parts/html.js';
import { stripCommentMarkers } from './template-bindings.test.js';

describe('optionalAttribute directive', () => {
    it('adds an attributes when condition is truthy', async () => {
        let condition = true;

        // SSR
        const templateResult = html`<div ${optionalAttribute(condition, 'attr', 'string')}></div>`;
        assert.equal(stripCommentMarkers(templateResult.toString()), "<div attr='string'></div>");
        // CSR
        const el = document.createElement('div');
        const directive = new OptionalAttributeDirective(el);
        directive.update(condition, 'attr', 'string');
        assert.isTrue(el.hasAttribute('attr'));
    });
    it('does not add an attributes when condition is falsy', async () => {
        let condition = false;
        // SSR
        const templateResult = html`<div ${optionalAttribute(condition, 'attr', 'string')}></div>`;
        assert.equal(stripCommentMarkers(templateResult.toString()), '<div></div>');
        // CSR
        const el = document.createElement('div');
        const directive = new OptionalAttributeDirective(el);
        directive.update(condition, 'attr', 'string');
        assert.isFalse(el.hasAttribute('attr'));
    });

    it('adds a boolean attributes when condition is truthy and the value is an empty string', async () => {
        // https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute#:~:text=into%20a%20string.-,Boolean,-attributes%20are%20considered
        let condition = true;

        // SSR
        const templateResult = html`<div ${optionalAttribute(condition, 'attr', '')}></div>`;
        assert.equal(stripCommentMarkers(templateResult.toString()), '<div attr></div>');
        // CSR
        const el = document.createElement('div');
        const directive = new OptionalAttributeDirective(el);
        directive.update(condition, 'attr', 'string');
        assert.isTrue(el.hasAttribute('attr'));
    });

    it('does add and remove an attributes when condition is toggled', async () => {
        let condition = true;
        // SSR
        const templateResult = html`<div ${optionalAttribute(condition, 'attr', 'string')}></div>`;
        assert.equal(stripCommentMarkers(templateResult.toString()), "<div attr='string'></div>");
        // CSR
        const el = document.createElement('div');
        const directive = new OptionalAttributeDirective(el);
        directive.update(condition, 'attr', 'string');
        assert.isTrue(el.hasAttribute('attr'));
        condition = false;
        // SSR
        const templateResult2 = html`<div ${optionalAttribute(condition, 'attr', 'string')}></div>`;
        assert.equal(stripCommentMarkers(templateResult2.toString()), '<div></div>');
        // CSR
        directive.update(condition, 'attr', 'string');
        assert.isFalse(el.hasAttribute('attr'));
    });
});
