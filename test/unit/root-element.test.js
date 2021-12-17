/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, oneEvent, nextFrame } from '@open-wc/testing';
import { TemplateElement, html } from '../../src/TemplateElement';

const lightTag = defineCE(
    class extends TemplateElement {
        template() {
            return html` <button ref="lightRef">Click me</button> `;
        }

        events() {
            return {
                '[ref=lightRef]': {
                    click: () => this.dispatch('light-event'),
                },
            };
        }
    },
);

const shadowTag = defineCE(
    class extends TemplateElement {
        constructor() {
            super({ shadowRender: true });
        }

        properties() {
            return {
                count: 0,
            };
        }

        events() {
            return {
                '[ref=shadowRef]': {
                    click: () => {
                        this.count++;
                        this.dispatch('shadow-event');
                    },
                },
            };
        }

        template() {
            return html` <button ref="shadowRef">Click me</button> `;
        }
    },
);

describe('root-element', () => {
    it('binds event listeners for light dom', async () => {
        const el = await fixture(`<${lightTag}></${lightTag}>`);
        setTimeout(() => el.$refs.lightRef.click());
        await oneEvent(el, 'light-event');
    });

    it('binds event listeners for shadow dom', async () => {
        const el = await fixture(`<${shadowTag}></${shadowTag}>`);
        setTimeout(() => el.$refs.shadowRef.click());
        await oneEvent(el, 'shadow-event');
    });

    it('calls event listeners in shadow dom only once', async () => {
        const el = await fixture(`<${shadowTag}></${shadowTag}>`);
        assert.equal(el.count, 0);
        el.$refs.shadowRef.click();
        await nextFrame();
        assert.equal(el.count, 1);
    });
});
