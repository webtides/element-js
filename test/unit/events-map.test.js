/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';
import { TemplateElement, html } from '../../src/TemplateElement.js';

const tag = defineCE(
    class extends BaseElement {
        // define as non property to prevent update and rebind
        complexEventCount = 0;
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
                    click: (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        this.windowEventCount++;
                    },
                    scroll: {
                        listener: (e) => {
                            this.complexEventCount++;
                        },
                        options: { once: true },
                    },
                    noOptions: {
                        listener: (e) => {
                            this.complexEventCount++;
                        },
                    },
                },
                document: {
                    click: (e) => {
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

class TemplateEventElement extends TemplateElement {
    properties() {
        return {
            count: 0,
            renderButtonRef: true,
        };
    }

    events() {
        return {
            ['[ref=btn]']: {
                click: () => this.count++,
            },
        };
    }

    template() {
        return html`${this.renderButtonRef ? html`<button ref="btn">click me</button>` : null}`;
    }
}

customElements.define('template-event-element', TemplateEventElement);

describe('events-map', async () => {
    it('maintains instance context even tho context is not bound explicitly when added via events map', async () => {
        const el = await fixture(`<${tag}><button ref="nobind"></button></${tag}>`);
        assert.equal(el.count, 0);
        el.$refs.nobind.click();
        await nextFrame();
        assert.equal(el.count, 1);
    });

    it('allows the auto-bound instance context to be overwritten by rebinding when added via events map', async () => {
        const el = await fixture(`<${tag}><button ref="windowbind"></button></${tag}>`);
        assert.equal(el.clickedByEventComponent, false);
        el.$refs.windowbind.click();
        await nextFrame();
        assert.equal(el.clickedByEventComponent, false);
        assert.equal(window.clickedByEventComponent, true);
    });

    it('listens to events that are dispatched window when added via event map', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        assert.equal(el.windowEventCount, 0);
        window.dispatchEvent(new Event('click'));
        await nextFrame();
        assert.equal(el.windowEventCount, 1);
        await nextFrame();
        window.dispatchEvent(new Event('click'));
        await nextFrame();
        assert.equal(el.windowEventCount, 2);
    });

    it('listens to events that are dispachted document when added via event map', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        assert.equal(el.documentEventCount, 0);
        window.document.dispatchEvent(new Event('click'));
        await nextFrame();
        assert.equal(el.documentEventCount, 1);
        window.document.dispatchEvent(new Event('click'));
        await nextFrame();
        assert.equal(el.documentEventCount, 2);
    });

    it('understands events defined in complex / detailed notation', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        assert.equal(el.complexEventCount, 0);
        window.dispatchEvent(new Event('scroll'));
        await nextFrame();
        assert.equal(el.complexEventCount, 1);
    });

    it('understands events defined in complex / detailed notation without options', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        assert.equal(el.complexEventCount, 0);
        window.dispatchEvent(new Event('noOptions'));
        await nextFrame();
        assert.equal(el.complexEventCount, 1);
    });

    it('understands events defined in complex / detailed notation and applies options', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        assert.equal(el.complexEventCount, 0);
        window.dispatchEvent(new Event('scroll'));
        await nextFrame();
        assert.equal(el.complexEventCount, 1);
        window.dispatchEvent(new Event('scroll'));
        await nextFrame();
        assert.equal(el.complexEventCount, 1);
    });

    it('will properly add and remove Events during update cycles for Template Elements', async () => {
        const el = await fixture(`<template-event-element></template-event-element>`);
        assert.equal(el.count, 0);
        // click button and expect increment
        el.$refs.btn?.click();
        assert.equal(el.count, 1);

        //remove BTN with listener from DOM
        el.renderButtonRef = false;
        await el.requestUpdate();
        assert.isUndefined(el.$refs.btn);

        //add BTN with listener back to DOM
        el.renderButtonRef = true;
        await el.requestUpdate();
        assert.isDefined(el.$refs.btn);
        // click button and expect only one increment from one listener
        el.$refs.btn?.click();
        assert.equal(el.count, 2);
    });
});
