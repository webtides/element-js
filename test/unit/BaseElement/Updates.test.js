/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, oneEvent, nextFrame } from '@open-wc/testing';
import { BaseElement } from '../../../src/BaseElement';

const requestAsyncAnimationFrame = () => {
    return new Promise((resolve, reject) => {
        requestAnimationFrame(() => {
            resolve();
        });
    });
};

const tag = defineCE(
    class extends BaseElement {
        constructor(options) {
            super(options);
            this.connected = false;
            this.beforeUpdate = false;
            this.afterUpdate = false;
            this.calledHooks = [];
            this.afterUpdateCalled = 0;
        }

        properties() {
            return {
                counter: 0,
            };
        }

        hooks() {
            return {
                connected: () => {
                    this.connected = true;
                    this.calledHooks.push('connected');
                },
                beforeUpdate: () => {
                    this.beforeUpdate = true;
                    this.calledHooks.push('beforeUpdate');
                },
                afterUpdate: () => {
                    this.afterUpdate = true;
                    this.calledHooks.push('afterUpdate');

                    this.afterUpdateCalled++;
                },
            };
        }
    },
);

describe('Updates', () => {
    it('can request an update for the element', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        assert.isFalse(el.beforeUpdate);
        assert.isFalse(el.afterUpdate);

        await el.requestUpdate();

        assert.isTrue(el.beforeUpdate);
        assert.isTrue(el.afterUpdate);
    });

    it('can request a silent update for the element without notifying the hooks', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        assert.isFalse(el.beforeUpdate);
        assert.isFalse(el.afterUpdate);

        await el.requestUpdate({ notify: false });

        assert.isFalse(el.beforeUpdate);
        assert.isFalse(el.afterUpdate);
    });

    it('pools the updates in one frame and only updates once', async () => {
        const el = await fixture(`<${tag}></${tag}>`);

        assert.equal(el.counter, 0);
        assert.equal(el.afterUpdateCalled, 0);

        for (let i = 0; i < 5; i++) {
            el.counter++;
        }

        await nextFrame();

        assert.equal(el.counter, 5);
        assert.equal(el.afterUpdateCalled, 1);
    });

    it('does not pool updates between animation frames.', async () => {
        const el = await fixture(`<${tag}></${tag}>`);

        assert.equal(el.counter, 0);
        assert.equal(el.afterUpdateCalled, 0);

        for (let i = 0; i < 5; i++) {
            el.counter++;
            await nextFrame();
        }

        assert.equal(el.counter, 5);
        assert.equal(el.afterUpdateCalled, 5);
    });

    it('Informs all listeners of the update.', async () => {
        const el = await fixture(`<${tag}></${tag}>`);

        assert.equal(el.counter, 0);
        assert.equal(el.afterUpdateCalled, 0);

        el.counter++;

        let numberOfUpdatesPassed = 0;

        const firstUpdate = el.requestUpdate().then(() => {
            numberOfUpdatesPassed++;
            return Promise.resolve();
        });

        const secondUpdate = el.requestUpdate().then(() => {
            numberOfUpdatesPassed++;
            return Promise.resolve();
        });

        await nextFrame();

        const thirdUpdate = el.requestUpdate().then(() => {
            numberOfUpdatesPassed++;
            return Promise.resolve();
        });

        const fourthUpdatePassed = el.requestUpdate().then(() => {
            numberOfUpdatesPassed++;
            return Promise.resolve();
        });

        assert.equal(el.counter, 1);
        assert.equal(el.afterUpdateCalled, 1);

        await Promise.all([firstUpdate, secondUpdate, thirdUpdate, fourthUpdatePassed]);
        assert.equal(numberOfUpdatesPassed, 4);
    });

    it('does not call after update on every requested animation frame.', async () => {
        const el = await fixture(`<${tag}></${tag}>`);

        assert.equal(el.afterUpdateCalled, 0);

        await nextFrame();

        assert.equal(el.afterUpdateCalled, 0);

        el.counter++;

        await nextFrame();
        await nextFrame();
        await nextFrame();
        await nextFrame();

        assert.equal(el.counter, 1);
        assert.equal(el.afterUpdateCalled, 1);
    });
});
