/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, html, nextFrame } from '@open-wc/testing';
import { BaseElement } from 'src/BaseElement';

const outerTag = defineCE(
    class extends BaseElement {
        constructor() {
            super({ shadowRender: true });
        }

        connected() {
            this.connectedCalled = true;
        }

        properties() {
            return {
                connectedCalled: false,
            };
        }

        template() {
            return html`
                <div>outer content</div>
                <slot></slot>
            `;
        }
    },
);

const innerTag = defineCE(
    class extends BaseElement {
        connected() {
            this.connectedCalled = true;
        }

        properties() {
            return {
                connectedCalled: false,
            };
        }

        template() {
            return html`
                <div>inner content</div>
            `;
        }
    },
);

describe('nesting-elements', () => {
    it('nested elements will get connected along side outer elements', async () => {
        const el = await fixture(`
            <${outerTag}>
                <${innerTag} ref="nested"></${innerTag}>
            </${outerTag}>
        `);

        await nextFrame();

        assert.isTrue(el.connectedCalled);

        const innerElement = el.querySelector(`${innerTag}`);

        await nextFrame();
        assert.isTrue(innerElement.connectedCalled);
    });
});
