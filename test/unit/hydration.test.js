import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { html, TemplateElement } from '../../src/TemplateElement.js';
import { render } from '../../src/dom-parts/render.js';
import { stripCommentMarkers } from '../util/testing-helpers.js';

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
        const el = await fixture(`<div>
            <!--template-part-->

                <!--dom-part-0?type=attribute&name=data-count&initialValue=%03-->
            <p data-count="0">
                count:   <!--dom-part-1-->0<!--/dom-part-1-->
            </p>

            <!--/template-part-->
        </div>`);
        const template = (count) => html`<p data-count="${count}">count: ${count}</p>`;
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
});
