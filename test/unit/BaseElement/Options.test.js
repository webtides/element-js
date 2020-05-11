/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { BaseElement } from '../../../src/BaseElement';

const deferTag = defineCE(
    class extends BaseElement {
        properties() {
            return {
                updateCalled: false,
            };
        }

        update(options = { notify: true }) {
            this.updateCalled = true;
            super.update(options);
        }
    },
);

const immediateTag = defineCE(
    class extends BaseElement {
        constructor() {
            super({ deferUpdate: false });
        }

        properties() {
            return {
                updateCalled: false,
            };
        }

        update(options = { notify: true }) {
            this.updateCalled = true;
            super.update(options);
        }
    },
);

describe('Options', () => {
    it('will defer initial rendering by default', async () => {
        const el = await fixture(`<${deferTag}></${deferTag}>`);
        assert.isFalse(el.updateCalled);
    });

    it('can disable initial rendering via attribute', async () => {
        const el = await fixture(`<${immediateTag} deferUpdate></${immediateTag}>`);
        assert.isFalse(el.updateCalled);
    });

    it('will update immediately if deferUpdate:true is passed via constructor options', async () => {
        const el = await fixture(`<${immediateTag}></${immediateTag}>`);
        assert.isTrue(el.updateCalled);
    });
});
