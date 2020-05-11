/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { BaseElement } from '../../../src/BaseElement';

const tag = defineCE(
    class extends BaseElement {
        constructor() {
            super();
            this.updateCount = 0;
        }

        hooks() {
            return {
                afterUpdate: () => {
                    this.updateCount++;
                },
            };
        }
    },
);

describe('ChildListMutation', () => {
    it('updates after childnodes has been added', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        el.updateCount = 0;
        el.innerHTML = `<span>i am nested</span>`;

        setTimeout(() => {
            assert.equal(el.updateCount, 1);
        }, 50);
    });
    it('updates after childnodes has been removed', async () => {
        const el = await fixture(`<${tag}><span id="remove"></span></${tag}>`);
        el.updateCount = 0;
        el.removeChild(el.querySelector('#remove'));
        setTimeout(() => {
            assert.equal(el.updateCount, 1);
        }, 50);
    });
});
