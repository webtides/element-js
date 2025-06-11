/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement.js';

describe('element-states', () => {
    it('adds the "connected" state when the element is connected to the DOM', async () => {
        const tag = defineCE(class extends BaseElement {});

        const el = await fixture(`<${tag}></${tag}>`);

        await nextFrame();

        assert.isTrue(el._internals.states.has('connected'));
    });

    it('adds the "connected" state when the element has deferred updates', async () => {
        const deferredTag = defineCE(
            class extends BaseElement {
                constructor() {
                    super({ deferUpdate: true });
                }
            },
        );

        const el = await fixture(`<${deferredTag}></${deferredTag}>`);

        await nextFrame();

        assert.isTrue(el._internals.states.has('connected'));
    });
});
