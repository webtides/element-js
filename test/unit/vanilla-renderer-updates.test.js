import { TemplateElement, html } from '../../src/TemplateElement.js';
import { assert, fixture } from '@open-wc/testing';

class LoadingElement extends TemplateElement {
    properties() {
        return {
            loading: true,
        };
    }

    template() {
        console.log('load prop:', this.load);
        return html` ${this.loading ? html`<p>loading ...</p>` : 'ready'} `;
    }
}

customElements.define('loading-element', LoadingElement);

describe(`vanilla-renderer-updates`, () => {
    it('should rerender a nested template/html literal even if this is in a ternary ', async () => {
        const el = await fixture(`<loading-element></loading-element>`);
        await el.requestUpdate();
        assert.isTrue(el.innerText.includes('loading'));
        el.loading = false;
        await el.requestUpdate();
        assert.isFalse(el.innerText.includes('loading'));
        el.loading = true;
        await el.requestUpdate();
        assert.isTrue(el.innerText.includes('loading'));
    });
});
