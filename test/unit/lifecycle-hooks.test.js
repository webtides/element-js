/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, oneEvent, nextFrame } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';

const tag = defineCE(
    class extends BaseElement {
        connectedCalled = false;
        beforeUpdateCalled = false;
        afterUpdateCalled = false;
        calledHooks = [];

        constructor() {
            super({ autoUpdate: true, deferUpdate: false });
        }

        connected() {
            this.connectedCalled = true;
            this.calledHooks.push('connected');
        }

        beforeUpdate() {
            this.beforeUpdateCalled = true;
            this.calledHooks.push('beforeUpdate');
        }

        afterUpdate() {
            this.afterUpdateCalled = true;
            this.calledHooks.push('afterUpdate');
        }

        disconnected() {
            this.dispatch('disconnected');
            this.calledHooks.push('disconnected');
        }

        properties() {
            return {
                count: 0,
            };
        }
    },
);

describe('lifecycle-hooks', () => {
    it('calls a "connected" hook when the element was connected to a document', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        assert.equal(el.connectedCalled, true);
    });

    it('calls a "beforeUpdate" hook when the element is about to be updated', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        assert.equal(el.beforeUpdateCalled, false);
        el.count++;
        await nextFrame();

        assert.equal(el.beforeUpdateCalled, true);
    });

    it('calls a "afterUpdate" hook when the element was updated', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        assert.equal(el.afterUpdateCalled, false);
        el.count++;
        await nextFrame();
        assert.equal(el.afterUpdateCalled, true);
    });

    it('calls a "disconnected" hook when the element was removed from a document', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        setTimeout(() => {
            el.parentNode.removeChild(el);
        });
        await oneEvent(el, 'disconnected');
    });

    it('calls all hooks in the correct order at connection and after updating the element', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        assert.deepEqual(el.calledHooks, ['connected']);
        el.count++;
        await nextFrame();
        assert.deepEqual(el.calledHooks, ['connected', 'beforeUpdate', 'afterUpdate']);
    });
});
