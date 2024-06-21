/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { html } from '../../src/TemplateElement.js';
import {
    OptionalAttributeDirective,
    spreadAttributes,
    SpreadAttributesDirective,
} from '../../src/dom-parts/directives.js';
import { stripCommentMarkers } from './renderer/template-bindings.js';

describe('spreadAttributes directive', () => {
    it('adds an attributes when condition is truthy', async () => {
        let condition = true;

        const el = document.createElement('div');
        const directive = new OptionalAttributeDirective(el);
        directive.update(condition, 'attr', true);
        assert.isTrue(el.hasAttribute('attr'));
    });
    it('does not add an attributes when condition is falsy', async () => {
        let condition = false;

        const el = document.createElement('div');
        const directive = new OptionalAttributeDirective(el);
        directive.update(condition, 'attr', true);
        assert.isFalse(el.hasAttribute('attr'));
    });

    it('does add and remove an attributes when condition is toggled', async () => {
        let condition = true;

        const el = document.createElement('div');
        const directive = new OptionalAttributeDirective(el);
        directive.update(condition, 'attr', true);
        assert.isTrue(el.hasAttribute('attr'));
        condition = false;
        directive.update(condition, 'attr', true);
        assert.isFalse(el.hasAttribute('attr'));
    });
});
