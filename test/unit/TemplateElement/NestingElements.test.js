/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { TemplateElement, html } from '../../../src/TemplateElement';

const outerTag = defineCE(
    class extends TemplateElement {
        hooks() {
            return {
                connected: () => {
                    this.connected = true;
                },
            };
        }

        properties() {
            return {
                connected: false,
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
    class extends TemplateElement {
        hooks() {
            return {
                connected: () => {
                    this.connected = true;
                },
            };
        }

        properties() {
            return {
                connected: false,
            };
        }

        template() {
            return html`
                <div>inner content</div>
            `;
        }
    },
);

describe('NestingElements', () => {
    it('nested elements will get connected along side outer elements', async () => {
        const el = await fixture(`
            <${outerTag}>
                <${innerTag} ref="nested"></${innerTag}>
            </${outerTag}>
        `);

        assert.isTrue(el.connected);

        const innerElement = el.querySelector(`${innerTag}`);
        assert.isTrue(innerElement.connected);
    });
});
