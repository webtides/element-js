/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { html } from '../../src/TemplateElement.js';
import { spreadAttributes, SpreadAttributesDirective } from '../../src/dom-parts/directives.js';
import { stripCommentMarkers } from './renderer/template-bindings.js';

describe('spreadAttributes directive', () => {
    it('maps primitive values to string attributes', async () => {
        // SSR
        const attributes = {
            string: 'string',
            number: 13,
            boolean: true,
        };
        const templateResult = html`<div ${spreadAttributes(attributes)}></div>`;
        assert.equal(
            stripCommentMarkers(templateResult.toString()),
            "<div string='string' number='13' boolean='true'></div>",
        );

        // CSR
        const el = document.createElement('div');
        const directive = new SpreadAttributesDirective(el);
        directive.update(attributes);
        assert.equal(el.getAttribute('string'), 'string');
        assert.equal(el.getAttribute('number'), '13');
        assert.equal(el.getAttribute('boolean'), 'true');
    });

    it('maps object like values to encoded and JSON parsable attributes', async () => {
        // SSR
        const attributes = {
            list: [1, '2', 3],
            map: { foo: 'bar' },
        };
        const templateResult = html`<div ${spreadAttributes(attributes)}></div>`;
        assert.equal(
            stripCommentMarkers(templateResult.toString()),
            "<div list='[1,&quot;2&quot;,3]' map='{&quot;foo&quot;:&quot;bar&quot;}'></div>",
        );

        // CSR
        const el = document.createElement('div');
        const directive = new SpreadAttributesDirective(el);
        directive.update(attributes);
        assert.equal(el.getAttribute('list'), '[1,&quot;2&quot;,3]');
        assert.equal(el.getAttribute('map'), '{&quot;foo&quot;:&quot;bar&quot;}');
    });

    it('converts camelCase names to dash-case', async () => {
        // SSR
        const attributes = {
            camelToDash: 'automagically',
        };
        const templateResult = html`<div ${spreadAttributes(attributes)}></div>`;
        assert.equal(stripCommentMarkers(templateResult.toString()), "<div camel-to-dash='automagically'></div>");

        // CSR
        const el = document.createElement('div');
        const directive = new SpreadAttributesDirective(el);
        directive.update(attributes);
        assert.equal(el.getAttribute('camel-to-dash'), 'automagically');
    });
});
