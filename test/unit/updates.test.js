/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, oneEvent, nextFrame } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';

const tag = defineCE(
    class extends BaseElement {
        constructor(options) {
            super(options);
            this.connectedCalled = false;
            this.beforeUpdateCalled = false;
            this.afterUpdateCalled = false;
            this.calledHooks = [];
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

        properties() {
            return {
                firstName: 'John',
                lastName: 'Doe',
                age: 42,
                ageChanged: false,
            };
        }

        watch() {
            return {
                age: () => {
                    this.ageChanged = true;
                },
            };
        }
    },
);

describe('updates', () => {
    it('can request an update for the element', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        assert.isFalse(el.beforeUpdateCalled);
        assert.isFalse(el.afterUpdateCalled);
        await el.requestUpdate();
        assert.isTrue(el.beforeUpdateCalled);
        assert.isTrue(el.afterUpdateCalled);
    });

    it('can request a silent update for the element without notifying the hooks', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        assert.isFalse(el.beforeUpdateCalled);
        assert.isFalse(el.afterUpdateCalled);
        await el.requestUpdate({}, false);
        assert.isFalse(el.beforeUpdateCalled);
        assert.isFalse(el.afterUpdateCalled);
    });

    // it('updates/renders the element asynchronously', async () => {
    //     const el = await fixture(`<${tag}></${tag}>`);
    //     assert.equal(el.firstName, 'John');
    //     el.firstName = 'Jane';
    //     assert.equal(el.firstName, 'John');
    //     await nextFrame();
    //     assert.equal(el.firstName, 'Jane');
    // });
    //
    // it('batches multiple updates and only renders once after all updates are done', async () => {
    //     const el = await fixture(`<${tag}></${tag}>`);
    //     el.firstName = 'Jane';
    //     el.lastName = 'Smith';
    //     await nextFrame();
    //     assert.deepEqual(el.calledHooks, ['connected', 'beforeUpdate', 'afterUpdate']);
    // });
    //
    // it('updates property changes "triggered" in watched properties in the same cycle', async () => {
    //     const el = await fixture(`<${tag}></${tag}>`);
    //     assert.isFalse(el.ageChanged);
    //     el.age = 32;
    //     await nextFrame();
    //     assert.isTrue(el.ageChanged);
    //     assert.deepEqual(el.calledHooks, ['connected', 'beforeUpdate', 'afterUpdate']);
    // });
});
