import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { html, TemplateElement } from '../../src/TemplateElement.js';
import { render } from '../../src/dom-parts/render.js';
import { stripCommentMarkers } from '../util/testing-helpers.js';
import { templateHash } from '../../src/dom-parts/parseTemplate.js';

/**
 * Renders the template on the "server" (toString) into a container, like the SSR renderer would deliver it.
 * @param {TemplateResult} templateResult
 * @return {Promise<HTMLElement>}
 */
const serverRendered = async (templateResult) => fixture(`<div>${templateResult.toString()}</div>`);

const withWarnings = async (fn) => {
    const warnings = [];
    const original = console.warn;
    console.warn = (...args) => warnings.push(args);
    try {
        await fn();
    } finally {
        console.warn = original;
    }
    return warnings;
};

// records the lifecycle of an element in a mixed array, hydration must not disconnect and reconnect it
const lifecycle = [];
customElements.define(
    'hydration-lifecycle-el',
    class extends HTMLElement {
        connectedCallback() {
            lifecycle.push('connected');
        }

        disconnectedCallback() {
            lifecycle.push('disconnected');
        }
    },
);

describe('hydration of server rendered templates', () => {
    it('keeps the server rendered text on hydration and updates it afterwards', async () => {
        const template = (text) => html`<p>${text}</p>`;
        const el = await serverRendered(template('Foo'));

        render(template('Foo'), el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<p>Foo</p>');

        render(template('Bar'), el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<p>Bar</p>');
    });

    it('updates attribute parts on hydrated elements', async () => {
        const template = (count) => html`<p data-count="${count}">count: ${count}</p>`;
        const el = await serverRendered(template(0));
        const p = el.querySelector('p');

        render(template(0), el);
        assert.equal(p.getAttribute('data-count'), '0');

        render(template(5), el);
        assert.equal(p.getAttribute('data-count'), '5');
        assert.equal(stripCommentMarkers(p.textContent), 'count: 5');
        assert.strictEqual(el.querySelector('p'), p, 'the server rendered element is kept');
    });

    it('leaves a server rendered attribute that starts with "on" alone and updates it', async () => {
        const template = (state) => html`<p on="${state}">x</p>`;
        const el = await serverRendered(template('default'));
        const observer = new MutationObserver(() => {});
        observer.observe(el, { childList: true, attributes: true, characterData: true, subtree: true });

        render(template('default'), el);
        const records = observer.takeRecords();
        observer.disconnect();
        assert.deepEqual(
            records.map((record) => `${record.type} on ${record.target.nodeName}`),
            [],
        );

        render(template('other'), el);
        assert.equal(el.querySelector('p').getAttribute('on'), 'other');
    });

    it('updates boolean attribute parts on hydrated elements', async () => {
        const template = (disabled) => html`<button ?disabled="${disabled}">x</button>`;
        const el = await serverRendered(template(true));
        const button = el.querySelector('button');
        assert.isTrue(button.hasAttribute('disabled'));

        render(template(true), el);
        assert.isTrue(button.hasAttribute('disabled'));

        render(template(false), el);
        assert.isFalse(button.hasAttribute('disabled'));
    });

    it('takes over a server rendered name="false", like element-js reflection renders it', async () => {
        const template = (loaded) => html`<span ?loaded="${loaded}">x</span>`;
        // a child element that reflects its `loaded: false` property leaves loaded="false" in the server markup
        const el = await fixture(`<div>${template(false).toString().replace('<span', '<span loaded="false"')}</div>`);
        const span = el.querySelector('span');

        render(template(false), el);
        assert.isFalse(span.hasAttribute('loaded'));

        render(template(true), el);
        assert.equal(span.getAttribute('loaded'), '');
    });

    it('removes a boolean attribute for the string "false" on hydrated elements', async () => {
        const template = (loaded) => html`<span ?loaded="${loaded}">x</span>`;
        const el = await serverRendered(template(true));
        const span = el.querySelector('span');

        render(template(true), el);
        assert.isTrue(span.hasAttribute('loaded'));

        render(template('false'), el);
        assert.isFalse(span.hasAttribute('loaded'));
    });

    it('updates attributes with multiple interpolations on hydrated elements', async () => {
        const template = (a, b) => html`<p class="${a} static ${b}">x</p>`;
        const el = await serverRendered(template('one', 'two'));
        const p = el.querySelector('p');

        render(template('one', 'two'), el);
        assert.equal(p.getAttribute('class'), 'one static two');

        render(template('uno', 'dos'), el);
        assert.equal(p.getAttribute('class'), 'uno static dos');
    });

    it('grows and shrinks hydrated lists', async () => {
        const template = (items) =>
            html`<ul>
                ${items.map((item) => html`<li>${item}</li>`)}
            </ul>`;
        const el = await serverRendered(template(['a', 'b']));

        render(template(['a', 'b']), el);
        assert.deepEqual(
            [...el.querySelectorAll('li')].map((li) => li.textContent),
            ['a', 'b'],
        );

        render(template(['a', 'b', 'c']), el);
        assert.deepEqual(
            [...el.querySelectorAll('li')].map((li) => li.textContent),
            ['a', 'b', 'c'],
        );

        render(template(['x']), el);
        assert.deepEqual(
            [...el.querySelectorAll('li')].map((li) => li.textContent),
            ['x'],
        );
    });

    it('updates a nested template at the root of a nested template', async () => {
        const inner = (text) => html`${text ? html`<b>${text}</b>` : null}`;
        const template = (text) => html`<div>${inner(text)}</div>`;
        const el = await serverRendered(template('a'));

        render(template('a'), el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div><b>a</b></div>');

        render(template('b'), el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div><b>b</b></div>');

        render(template(null), el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div></div>');
    });

    it('attaches event listeners on hydration', async () => {
        let clicks = 0;
        const template = () => html`<button @click="${() => clicks++}">x</button>`;
        const el = await serverRendered(template());

        render(template(), el);
        el.querySelector('button').click();
        assert.equal(clicks, 1);
    });

    it('applies property bindings on hydration', async () => {
        const template = (data) => html`<p .data="${data}">x</p>`;
        const el = await serverRendered(template({ foo: 'bar' }));

        render(template({ foo: 'bar' }), el);
        assert.deepEqual(el.querySelector('p').data, { foo: 'bar' });
    });

    it('renders a nested template that the server did not render', async () => {
        const template = (show) => html`<div>${show ? html`<b>on</b>` : null}</div>`;
        const el = await serverRendered(template(false));
        assert.equal(stripCommentMarkers(el.innerHTML), '<div></div>');

        render(template(true), el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div><b>on</b></div>');

        render(template(false), el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div></div>');
    });

    it('does not depend on whitespace around the markers', async () => {
        const template = (count) => html`<p data-count="${count}">count: ${count}</p>`;
        const el = await fixture(`<div>
            <!--t:${templateHash(template(0).strings)}-->

                <!--0-->
            <p data-count="0">
                count:   <!--1-->0<!--/1-->
            </p>

            <!--/t-->
        </div>`);
        const p = el.querySelector('p');

        render(template(0), el);
        render(template(7), el);
        assert.strictEqual(el.querySelector('p'), p);
        assert.equal(p.getAttribute('data-count'), '7');
        assert.equal(stripCommentMarkers(p.textContent), 'count: 7');
    });

    it('warns and renders client side when the server markers do not match the template', async () => {
        const el = await serverRendered(html`<p class="${'a'}">server</p>`);
        const template = (id) => html`<p id="${id}">client</p>`;

        const warnings = await withWarnings(async () => render(template('a'), el));

        assert.equal(warnings.length, 1);
        assert.include(warnings[0][0], 'do not match');
        assert.equal(stripCommentMarkers(el.innerHTML), '<p id="a">client</p>');

        render(template('b'), el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<p id="b">client</p>');
    });

    it('updates the DOM of a hydrated element when its properties change', async () => {
        const tag = defineCE(
            class extends TemplateElement {
                properties() {
                    return { count: 0, items: ['a', 'b'] };
                }

                template() {
                    return html`<p data-count="${this.count}">count: ${this.count}</p>
                        <ul>
                            ${this.items.map((item) => html`<li>${item}</li>`)}
                        </ul>`;
                }
            },
        );
        const serverMarkup = html`<p data-count="${0}">count: ${0}</p>
            <ul>
                ${['a', 'b'].map((item) => html`<li>${item}</li>`)}
            </ul>`.toString();

        const el = await fixture(`<${tag}>${serverMarkup}</${tag}>`);
        await nextFrame();
        const p = el.querySelector('p');
        assert.equal(p.getAttribute('data-count'), '0');
        assert.equal(el.querySelectorAll('li').length, 2);

        el.count = 5;
        el.items = ['a', 'b', 'c'];
        await nextFrame();
        await nextFrame();

        assert.strictEqual(el.querySelector('p'), p, 'the server rendered element is kept');
        assert.equal(p.getAttribute('data-count'), '5');
        assert.equal(stripCommentMarkers(p.textContent), 'count: 5');
        assert.deepEqual(
            [...el.querySelectorAll('li')].map((li) => li.textContent),
            ['a', 'b', 'c'],
        );
    });

    it('binds the templates of a mixed array to their own server rendered markers', async () => {
        let clicks = 0;
        const template = () =>
            html`<div>${[html`<span>a</span>`, 'text', html`<button @click="${() => clicks++}">b</button>`]}</div>`;
        const el = await serverRendered(template());
        const serverButton = el.querySelector('button');

        render(template(), el);
        assert.strictEqual(el.querySelector('button'), serverButton);
        serverButton.click();
        assert.equal(clicks, 1);

        render(template(), el);
        serverButton.click();
        assert.equal(clicks, 2);
    });

    it('keeps a focused input in a mixed array on hydration', async () => {
        const template = () => html`<div>${['prefix', html`<input />`]}</div>`;
        const el = await serverRendered(template());
        const input = el.querySelector('input');
        input.focus();
        assert.isTrue(document.activeElement === input);

        render(template(), el);
        // compared as booleans: a failing strictEqual on DOM nodes makes chai format the whole document
        assert.isTrue(el.querySelector('input') === input, 'the server rendered input is kept');
        assert.isTrue(document.activeElement === input, 'the focus is kept');
    });

    it('does not reconnect custom elements in a mixed array on hydration', async () => {
        const template = () => html`<div>${['prefix', html`<hydration-lifecycle-el></hydration-lifecycle-el>`]}</div>`;
        const el = await serverRendered(template());
        lifecycle.length = 0;

        render(template(), el);
        assert.deepEqual(lifecycle, []);

        render(template(), el);
        assert.deepEqual(lifecycle, []);
    });

    it('keeps a hydrated template when the server rendered a text in front of it', async () => {
        const template = (items) => html`<div>${items}</div>`;
        const inner = () => html`<b>x</b>`;
        const el = await serverRendered(template(['prefix', inner()]));

        render(template([inner()]), el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div><b>x</b></div>');
    });

    it('moves a hydrated template behind a text the server did not render', async () => {
        const template = (items) => html`<div>${items}</div>`;
        const inner = () => html`<b>x</b>`;
        const el = await serverRendered(template([inner(), 'suffix']));

        render(template(['prefix', inner()]), el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>prefix<b>x</b></div>');
    });

    it('renders an item of a mixed array client side when its server rendered markers do not match', async () => {
        let clicks = 0;
        const template = (items) => html`<div>${items}</div>`;
        const el = await serverRendered(template(['prefix', html`<button @input="${() => {}}">b</button>`]));

        const warnings = await withWarnings(async () =>
            render(template(['prefix', html`<button @click="${() => clicks++}">b</button>`]), el),
        );
        assert.equal(warnings.length, 1);
        el.querySelector('button').click();
        assert.equal(clicks, 1);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>prefix<button>b</button></div>');
    });

    it('renders an item of a list client side when its server rendered markers do not match', async () => {
        let clicks = 0;
        const template = (items) => html`<div>${items}</div>`;
        const el = await serverRendered(template([html`<button @input="${() => {}}">b</button>`]));

        await withWarnings(async () => render(template([html`<button @click="${() => clicks++}">b</button>`]), el));
        el.querySelector('button').click();
        assert.equal(clicks, 1);
    });

    it('keeps both equal siblings of a hydrated template when a text is inserted in front of it', async () => {
        const template = (items) => html`<div>${items}</div>`;
        // the two equal siblings have to be adjacent, a whitespace text node between them would hide the case
        // prettier-ignore
        const inner = () => html`<li>x</li><li>x</li>`;
        const el = await serverRendered(template([inner()]));

        render(template(['prefix', inner()]), el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>prefix<li>x</li><li>x</li></div>');
        assert.equal(el.querySelectorAll('li').length, 2);
    });

    it('leaves a hydrated template untouched when the text in front of it goes away', async () => {
        const template = (items) => html`<div>${items}</div>`;
        const inner = () => html`<input />`;
        const el = await serverRendered(template(['prefix', inner()]));
        const input = el.querySelector('input');
        input.focus();

        render(template([inner()]), el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div><input></div>');
        assert.isTrue(el.querySelector('input') === input, 'the server rendered input is kept');
        assert.isTrue(document.activeElement === input, 'the focus is kept');
    });

    it('hydrates nested arrays, function items and empty items of an array without touching the DOM', async () => {
        // kept on one line: whitespace around the items would show up next to the text item in the DOM
        // prettier-ignore
        const template = (items) => html`<ul>${items}</ul>`;
        const li = (text) => html`<li>${text}</li>`;
        const items = (text) => [li('a'), [li('b'), [li('c')]], () => li(text), () => 'text', null];
        const el = await serverRendered(template(items('d')));
        const observer = new MutationObserver(() => {});
        observer.observe(el, { childList: true, attributes: true, characterData: true, subtree: true });

        render(template(items('d')), el);
        const records = observer.takeRecords();
        observer.disconnect();
        assert.deepEqual(
            records.map((record) => `${record.type} on ${record.target.nodeName}`),
            [],
        );
        assert.equal(stripCommentMarkers(el.innerHTML), '<ul><li>a</li><li>b</li><li>c</li><li>d</li>text</ul>');

        render(template(items('e')), el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<ul><li>a</li><li>b</li><li>c</li><li>e</li>text</ul>');
    });

    it('leaves server rendered nodes alone when the values match', async () => {
        const template = (count, items) =>
            html`<p data-count="${count}" ?hidden="${false}" @click="${() => {}}">count: ${count}</p>
                <ul>
                    ${items.map((item) => html`<li>${item}</li>`)}
                </ul>`;
        const el = await serverRendered(template(3, ['a', 'b']));
        const observer = new MutationObserver(() => {});
        observer.observe(el, { childList: true, attributes: true, characterData: true, subtree: true });

        render(template(3, ['a', 'b']), el);
        const records = observer.takeRecords();
        observer.disconnect();
        assert.deepEqual(
            records.map((record) => `${record.type} on ${record.target.nodeName}`),
            [],
        );
    });

    it('takes over the server rendered text node and updates it in place', async () => {
        const template = (text) => html`<p>${text}</p>`;
        const el = await serverRendered(template('Foo'));
        const p = el.querySelector('p');
        const textNode = [...p.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.data === 'Foo');

        render(template('Foo'), el);
        render(template('Bar'), el);
        assert.isTrue(textNode.parentNode === p, 'the server rendered text node is kept');
        assert.equal(textNode.data, 'Bar');
    });

    it('keeps the static text of a raw text element on hydration and updates the interpolation', async () => {
        // prettier-ignore
        const template = (color) => html`<style>.a { color: ${color}; }</style><textarea>${color}</textarea>`;
        const container = await serverRendered(template('red'));
        assert.equal(container.querySelector('style').textContent, '.a { color: red; }');
        render(template('red'), container);
        assert.equal(container.querySelector('style').textContent, '.a { color: red; }');
        render(template('blue'), container);
        assert.equal(container.querySelector('style').textContent, '.a { color: blue; }');
        assert.equal(container.querySelector('textarea').textContent, 'blue');
    });
});
