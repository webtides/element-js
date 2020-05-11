/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { TemplateElement, html } from '../../../src/TemplateElement';

const shadowTag = defineCE(
    class extends TemplateElement {
        template() {
            return html`
                <div>shadow content</div>
            `;
        }
    },
);

const lightTag = defineCE(
    class extends TemplateElement {
        constructor() {
            super({ shadowRender: false });
        }

        template() {
            return html`
                <div>light content</div>
            `;
        }
    },
);

const deferTag = defineCE(
    class extends TemplateElement {
        constructor() {
            super({ deferUpdate: true });
        }

        template() {
            return html`
                <div>deferred content</div>
            `;
        }
    },
);

const noHtmlTag = defineCE(
    class extends TemplateElement {
        template() {
            return `<div>no html template result content</div>`;
        }
    },
);

describe('TemplateRendering', () => {
    it('renders template in shadow dom by default', async () => {
        const el = await fixture(`<${shadowTag}></${shadowTag}>`);
        assert.isNotNull(el.shadowRoot);
        assert.shadowDom.equal(el, '<div>shadow content</div>');
    });

    it('can update template in light dom by setting shadowRender: false via constructor options', async () => {
        const el = await fixture(`<${lightTag}></${lightTag}>`);
        assert.isNull(el.shadowRoot);
        assert.lightDom.equal(el, '<div>light content</div>');
    });

    it('can defer rendering template by setting deferUpdate: true via constructor options', async () => {
        const el = await fixture(`<${deferTag}></${deferTag}>`);
        assert.equal(el.innerHTML.trim(), '');
        assert.lightDom.equal(el, '');
        el.update();
        assert.shadowDom.equal(el, '<div>deferred content</div>');
    });

    it('can render standard strings as template instead of html template results', async () => {
        const el = await fixture(`<${noHtmlTag}></${noHtmlTag}>`);
        assert.shadowDom.equal(el, '<div>no html template result content</div>');
    });
});
