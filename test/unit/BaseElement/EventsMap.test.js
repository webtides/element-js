/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { BaseElement } from '../../../src/BaseElement';

const tag = defineCE(
    class extends BaseElement {
        constructor() {
            super({ autoUpdate: false });
        }

        properties() {
            return {
                count: 0,
                windowEventCount: 0,
                documentEventCount: 0,
                clickedByEventComponent: false,
            };
        }

        events() {
            return {
                'button[ref=nobind]': {
                    click: this.functionWithoutBind,
                },
                'button[ref=windowbind]': {
                    click: this.functionWithoutWindowBind.bind(window),
                },
                window: {
                    click: e => {
                        e.stopPropagation();
                        e.preventDefault();
                        this.windowEventCount++;
                    },
                },
                document: {
                    click: e => {
                        e.stopPropagation();
                        e.preventDefault();
                        this.documentEventCount++;
                    },
                },
            };
        }

        functionWithoutBind() {
            this.count++;
        }

        functionWithoutWindowBind() {
            this.clickedByEventComponent = true;
        }
    },
);

describe('EventsMap', () => {
    it('maintains instance context even tho context is not bound explicitly when added via events map', async () => {
        const el = await fixture(`<${tag}><button ref="nobind"></button></${tag}>`);
        assert.equal(el.count, 0);
        el.$refs.nobind.click();
        assert.equal(el.count, 1);
    });

    it('allows the auto-bound instance context to be overwriten by rebinding when added via events map', async () => {
        const el = await fixture(`<${tag}><button ref="windowbind"></button></${tag}>`);
        assert.equal(el.clickedByEventComponent, false);
        el.$refs.windowbind.click();
        assert.equal(el.clickedByEventComponent, false);
        assert.equal(window.clickedByEventComponent, true);
    });

    it('listens to events that are dispatched window when added via event map', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        assert.equal(el.windowEventCount, 0);
        window.dispatchEvent(new Event('click'));
        assert.equal(el.windowEventCount, 1);
        el.update();
        window.dispatchEvent(new Event('click'));
        assert.equal(el.windowEventCount, 2);
    });

    it('listens to events that are dispachted document when added via event map', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        assert.equal(el.documentEventCount, 0);
        window.document.dispatchEvent(new Event('click'));
        assert.equal(el.documentEventCount, 1);
        el.update();
        window.document.dispatchEvent(new Event('click'));
        assert.equal(el.documentEventCount, 2);
    });
});
