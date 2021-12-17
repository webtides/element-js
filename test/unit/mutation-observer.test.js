/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, oneEvent, nextFrame } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';

class UpdateCountElement extends BaseElement {
    constructor(options) {
        super({ deferUpdate: false, ...options });
        this.updateCount = 0;
    }

    afterUpdate() {
        this.updateCount++;
        this.dispatch('afterUpdate', null, true);
    }
}

const tag = defineCE(class extends UpdateCountElement {});

const subtreeObserverTag = defineCE(
    class extends UpdateCountElement {
        constructor() {
            super({ mutationObserverOptions: { subtree: true } });
        }
    },
);

const deprecatedChildListUpdateTag = defineCE(
    class extends UpdateCountElement {
        constructor() {
            super({ childListUpdate: false });
        }
    },
);

describe('mutation-observer', () => {
    it('requests an update when an attribute is changed from outside', async () => {
        const el = await fixture(`<${tag} count="0"></${tag}>`);
        el.setAttribute('count', '1');
        await oneEvent(el, 'afterUpdate');
        assert.equal(el.getAttribute('count'), '1');
        assert.equal(el.count, 1);
    });

    it('does not request an update when an attribute is changed on child elements', async () => {
        const el = await fixture(`<${tag}><span id="change" count="0"></span></${tag}>`);
        const changeElement = el.querySelector('#change');
        changeElement.setAttribute('count', '1');
        await nextFrame();
        assert.equal(el.updateCount, 0);
    });

    it('can request an update when an attribute is changed on child elements by setting the "subtree" option in mutationObserverOptions to true', async () => {
        const el = await fixture(`<${subtreeObserverTag}><span id="change" count="0"></span></${subtreeObserverTag}>`);
        const changeElement = el.querySelector('#change');
        changeElement.setAttribute('count', '1');
        await oneEvent(el, 'afterUpdate');
        assert.equal(el.updateCount, 1);
    });

    it('requests an update when a child node has been added', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        el.innerHTML = `<span>i am nested</span>`;
        await oneEvent(el, 'afterUpdate');
        assert.equal(el.updateCount, 1);
    });

    it('does not request an update when a child node gets added to a child element', async () => {
        const el = await fixture(`<${tag}><span id="add"></span></${tag}>`);
        const addElement = el.querySelector('#add');
        addElement.innerHTML = `<span>i am nested</span>`;
        await nextFrame();
        assert.equal(el.updateCount, 0);
    });

    it('can request an update when a child node gets added to a child element by setting the "subtree" option in mutationObserverOptions to true', async () => {
        const el = await fixture(`<${subtreeObserverTag}><span id="add"></span></${subtreeObserverTag}>`);
        const addElement = el.querySelector('#add');
        addElement.innerHTML = `<span>i am nested</span>`;
        await oneEvent(el, 'afterUpdate');
        assert.equal(el.updateCount, 1);
    });

    it('requests an update when a child node has been removed', async () => {
        const el = await fixture(`<${tag}><span id="remove"></span></${tag}>`);
        el.removeChild(el.querySelector('#remove'));
        await oneEvent(el, 'afterUpdate');
        assert.equal(el.updateCount, 1);
    });

    // TODO: remove test once "childListUpdate" has been removed from options completely
    it('can disable requesting updates when a child node has been added via deprecated "childListUpdate" option', async () => {
        const el = await fixture(`<${deprecatedChildListUpdateTag}></${deprecatedChildListUpdateTag}>`);
        el.innerHTML = `<span>i am nested</span>`;
        // TODO: is it correct or even right that the "requestUpdate" in combination with mutation observer will take two animation frames ?!
        // from my research the mutation observer should call the callback within the same frame
        // to test this behaviour remove one call to "nextFrame" and comment out the workaround in BaseElement.js:28
        await nextFrame();
        await nextFrame();
        assert.equal(el.updateCount, 0);
    });
});
