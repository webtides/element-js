import { fixture, assert, defineCE } from '@open-wc/testing';
import { html, TemplateElement } from '../../src/TemplateElement.js';

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

describe(`declarative shadow dom template rendering for`, () => {
    it('renders the template in shadow dom on the client if no declarative template is available', async () => {
        const el = await fixture(`<${shadowTag}></${shadowTag}>`);
        assert.isNotNull(el.shadowRoot);
        assert.shadowDom.equal(el, '<div>client side shadow root content</div>');
    });

    // it('uses the template in shadow dom from the server if a template element with shadowrootmode was provided', async () => {
    // 	const el = await fixture(
    // 		`<${shadowTag}><template shadowrootmode="open"><!--template-part--><div>server side shadow root content</div><!--/template-part--></template></${shadowTag}>`,
    // 	);
    // 	assert.isNotNull(el.shadowRoot);
    // 	assert.shadowDom.equal(el, '<div>server side shadow root content</div>');
    // });
});
