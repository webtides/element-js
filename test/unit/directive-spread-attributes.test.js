/* eslint-disable no-unused-expressions */
import { assert } from '@open-wc/testing';
import { html } from '../../src/TemplateElement.js';
import { spreadAttributes, SpreadAttributesDirective } from '../../src/dom-parts/directives.js';
import { stripCommentMarkers, stripWhitespace } from '../util/testing-helpers.js';

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
    it('removes attributes when set to "null" in spread directive', async () => {
        // SSR
        const attributes = {
            attr: true,
        };
        const el = document.createElement('div');
        const directive = new SpreadAttributesDirective(el);
        directive.update(attributes);
        assert.isTrue(el.hasAttribute('attr'));
        attributes.attr = null;
        directive.update(attributes);
        assert.isFalse(el.hasAttribute('attr'));
    });

    it('leaves out attributes with undefined, null or NaN values', async () => {
        const attributes = {
            href: undefined,
            target: null,
            tabindex: NaN,
            rel: 'noopener',
        };

        // SSR
        const templateResult = html`<a ${spreadAttributes(attributes)}>x</a>`;
        assert.equal(stripCommentMarkers(templateResult.toString()), "<a rel='noopener'>x</a>");

        // CSR
        const el = document.createElement('a');
        el.setAttribute('href', '/');
        el.setAttribute('target', '_blank');
        el.setAttribute('tabindex', '0');
        const directive = new SpreadAttributesDirective(el);
        directive.update(attributes);
        assert.deepEqual(el.getAttributeNames(), ['rel']);
    });

    it('writes a tag without attributes when every value is left out', async () => {
        const attributes = {
            href: undefined,
            target: null,
            tabindex: NaN,
        };

        // SSR
        const templateResult = html`<a ${spreadAttributes(attributes)}>x</a>`;
        const template = document.createElement('template');
        template.innerHTML = templateResult.toString();
        const anchor = template.content.querySelector('a');
        assert.equal(anchor.attributes.length, 0);
        assert.equal(anchor.textContent, 'x');

        // CSR
        const el = document.createElement('a');
        const directive = new SpreadAttributesDirective(el);
        directive.update(attributes);
        assert.equal(el.attributes.length, 0);
    });

    it('writes attributes with false, 0 or empty string values', async () => {
        const attributes = {
            boolean: false,
            number: 0,
            string: '',
        };

        // SSR
        const templateResult = html`<div ${spreadAttributes(attributes)}></div>`;
        assert.equal(
            stripCommentMarkers(templateResult.toString()),
            "<div boolean='false' number='0' string=''></div>",
        );

        // CSR
        const el = document.createElement('div');
        const directive = new SpreadAttributesDirective(el);
        directive.update(attributes);
        assert.equal(el.getAttribute('boolean'), 'false');
        assert.equal(el.getAttribute('number'), '0');
        assert.equal(el.getAttribute('string'), '');
    });
});
