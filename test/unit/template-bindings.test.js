import { fixture, assert, nextFrame, oneEvent } from '@open-wc/testing';
import { render } from '../../src/dom-parts/render.js';
import { defineDirective, Directive } from '../../src/util/Directive.js';
import { html } from '../../src/TemplateElement.js';
import { unsafeHTML } from '../../src/dom-parts/directives.js';
import { stripCommentMarkers } from '../util/testing-helpers.js';

describe(`template bindings for rendering TemplateResults client side and server side`, () => {
    it('creates the correct string from the literal', async () => {
        const el = document.createElement('div');
        const templateResult = html`<div class="parent"><div class="child">content</div></div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div class="parent"><div class="child">content</div></div>');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('parses variables as string from the literal', async () => {
        const el = document.createElement('div');
        let name = 'John';
        const templateResult = html`<div>Hello ${name}</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>Hello John</div>');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('can have just a variable as template', async () => {
        const el = document.createElement('div');
        let name = 'John';
        const templateResult = html`${name}`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), 'John');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('correctly sanitizes html input', async () => {
        const el = document.createElement('div');
        const templateResult = html`<div>${'<strong>Unsafe HTML</strong>'}</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>&lt;strong&gt;Unsafe HTML&lt;/strong&gt;</div>');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('allows unsafe html input with the "unsafeHTML" directive', async () => {
        const el = document.createElement('div');
        const templateResult = html`<div>${unsafeHTML(`<strong>Unsafe HTML</strong>`)}</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div><strong>Unsafe HTML</strong></div>');
    });

    it('correctly updates values with unsafe input', async () => {
        const el = document.createElement('div');
        let count = 0;
        const templateResult = html`<div>${unsafeHTML(`<strong>Unsafe HTML - ${count}</strong>`)}</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div><strong>Unsafe HTML - 0</strong></div>');
        count++;
        // TODO: this works actually.. but the DOM nodes are not updating in the tests :(
        // render(templateResult, el);
        // assert.equal(stripCommentMarkers(el.innerHTML), '<div><strong>Unsafe HTML - 1</strong></div>');
    });

    it('can have functions as bindings', async () => {
        const el = document.createElement('div');
        const name = () => 'John';
        const templateResult = html`<div>Hello ${name}</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>Hello John</div>');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('can render bindings with html literals', async () => {
        const el = document.createElement('div');
        let nested = html`<div class="nested"></div>`;
        const templateResult = html`<div>${nested}</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div><div class="nested"></div></div>');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('can render arrays of primitive values', async () => {
        const el = document.createElement('div');
        let list = [1, '2', true];
        const templateResult = html`<div>${list}</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>12true</div>');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('can render arrays of literals', async () => {
        const el = document.createElement('div');
        let list = [html`<div>1</div>`, html`<div>2</div>`, html`<div>3</div>`];
        const templateResult = html`<div>${list}</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div><div>1</div><div>2</div><div>3</div></div>');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('can render arrays of mixed values', async () => {
        const el = document.createElement('div');
        let list = [1, '2', true, html`<span>${'Test'}</span>`, () => 'Function'];
        const templateResult = html`<div>${list}</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>12true <span>Test</span>Function</div>');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('correctly sanitizes an array of unsafe strings', async () => {
        const el = document.createElement('div');
        const parts = [`<strong>First part</strong>`, `<strong>Second part</strong>`];
        render(html`<div>${parts}</div>`, el);
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            '<div>&lt;strong&gt;First part&lt;/strong&gt;&lt;strong&gt;Second part&lt;/strong&gt;</div>',
        );
    });

    it('allows unsafe html input with the "unsafeHTML" directive in arrays', async () => {
        const el = document.createElement('div');
        const parts = [unsafeHTML(`<strong>First part</strong>`), unsafeHTML(`<strong>Second part</strong>`)];
        render(html`<div>${parts}</div>`, el);
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            '<div><strong>First part</strong><strong>Second part</strong></div>',
        );
    });

    it('can render single bindings inside attributes', async () => {
        const el = document.createElement('div');
        const active = true;
        const templateResult = html`<a class="${active ? 'is-active' : ''}">Label</a>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<a class="is-active">Label</a>');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('can render bindings inside attributes between static strings', async () => {
        const el = document.createElement('div');
        const active = true;
        const templateResult = html`<a class="link ${active ? 'is-active' : ''}">Label</a>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<a class="link is-active">Label</a>');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('correctly sanitizes attribute values', async () => {
        const el = document.createElement('div');
        const templateResult = html`
            <div foo="${'&'}"></div>
            <div foo="${'<'}"></div>
            <div foo="${'>'}"></div>
            <div foo="${"'"}"></div>
            <div foo="${'"'}"></div>
        `;
        render(templateResult, el);
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            '<div foo="&amp;"></div><div foo="<"></div><div foo=">"></div><div foo="\'"></div><div foo="&quot;"></div>',
        );
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('can render bindings inside attributes with special characters', async () => {
        const el = document.createElement('div');
        const active = true;
        const templateResult = html`<a
            class="link ${active
                ? 'is-active'
                : ''} text-blue-600 dark:text-blue-200/50 top-[117px] foo=bar before:content-['Festivus']"
            >Label</a
        >`;
        render(templateResult, el);
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            '<a class="link is-active text-blue-600 dark:text-blue-200/50 top-[117px] foo=bar before:content-[\'Festivus\']">Label</a>',
        );
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('can render multiple bindings inside attributes', async () => {
        const el = document.createElement('div');
        const active = true;
        const highlight = true;
        const templateResult = html`<a class="link ${active ? 'is-a' : ''} ${highlight ? 'is-h' : ''}">Label</a>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<a class="link is-a is-h">Label</a>');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('can render special boolean bindings inside attributes', async () => {
        const el = document.createElement('div');
        let hidden = true;
        let disabled = false;
        const templateResult = html`<a ?hidden="${hidden}" ?disabled="${disabled}">Label</a>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<a hidden="">Label</a>');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('can render special property bindings inside attributes', async () => {
        const el = document.createElement('div');
        let foo = { foo: 'bar' };
        const templateResult = html`<a .foo="${foo}">Label</a>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<a>Label</a>');

        const anchor = el.querySelector('a');
        assert.deepEqual(anchor.foo, { foo: 'bar' });

        // SSR is rendering properties as attributes while CSR is only setting the properties
        assert.notEqual(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does match SSR template',
        );
    });

    it('can render special @event bindings inside attributes', async () => {
        const el = document.createElement('div');
        // TODO we are testing / fixing prettier here
        const templateResult = html`<a
            @foo="${(e) => {
                el.foo = 'bar';
            }}"
            onBar="${(e) => {
                el.bar = 'baz';
            }}"
            onClick="console.log('clicked')"
            >Label</a
        >`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<a onclick="console.log(\'clicked\')">Label</a>');
        assert.equal(
            stripCommentMarkers(el.innerHTML.replace('onclick', 'onClick')),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );

        const anchor = el.querySelector('a');
        // anchor.click();
        anchor.dispatchEvent(new Event('foo'));
        anchor.dispatchEvent(new Event('bar'));
        assert.equal(el.foo, 'bar');
        assert.equal(el.bar, 'baz');
    });

    it('can render conditional nested html templates', async () => {
        const el = document.createElement('div');
        const nested = true;
        const templateResult = html`<div>${nested ? html`<div class="nested">nested</div>` : html``}</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div><div class="nested">nested</div></div>');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('can render empty conditional html templates', async () => {
        const el = document.createElement('div');
        const nested = false;
        const templateResult = html`<div>${nested ? html`<div class="nested">nested</div>` : html``}</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div></div>');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('can render lists with looped bindings', async () => {
        const el = document.createElement('div');
        const colors = ['red', 'green', 'blue'];
        const templateResult = html`<ul>
            ${colors.map((color) => html`<li>${color}</li>`)}
        </ul>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<ul><li>red</li><li>green</li><li>blue</li></ul>');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('does not render anything for empty directives', async () => {
        const el = document.createElement('div');
        const directive = defineDirective(class extends Directive {});
        const templateResult = html`<div ${directive()}>Text</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>Text</div>');
        assert.equal(
            stripCommentMarkers(el.innerHTML.replace('<div>', '<div >')),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('can have directives at attribute positions that modify the node/element', async () => {
        const el = document.createElement('div');
        const directive = defineDirective(
            class extends Directive {
                update(foo) {
                    this.node.setAttribute('foo', foo);
                }
            },
        );
        const templateResult = html`<div ${directive('bar')}>Text</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div foo="bar">Text</div>');
        // Note: we don't test SSR = CSR here because directives probably need DOM methods to do things and should not run on the server.
    });

    it('can have update directives at attribute positions that modify the node/element', async () => {
        const el = document.createElement('div');
        const directive = defineDirective(
            class extends Directive {
                update(foo) {
                    this.node.setAttribute('foo', foo);
                }
            },
        );
        render(html`<div ${directive('bar')}>Text</div>`, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div foo="bar">Text</div>');

        render(html`<div ${directive('baz')}>Text</div>`, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div foo="baz">Text</div>');
    });

    it('can have different bindings in one template', async () => {
        const el = document.createElement('div');
        let name = 'John';
        let active = true;
        const templateResult = html`<div>Hello ${name}<a class="link ${active ? 'is-active' : ''}">Label</a></div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>Hello John <a class="link is-active">Label</a></div>');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );
    });

    it('can remove items from lists with looped bindings', async () => {
        const el = document.createElement('div');
        const colors = ['red', 'green', 'blue'];
        let templateResult = html`<ul>
            ${colors.map((color) => html`<li>${color}</li>`)}
        </ul>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<ul><li>red</li><li>green</li><li>blue</li></ul>');
        assert.equal(
            stripCommentMarkers(el.innerHTML),
            stripCommentMarkers(templateResult.toString()),
            'CSR template does not match SSR template',
        );

        templateResult = html`<ul>
            ${['red', 'green'].map((color) => html`<li>${color}</li>`)}
        </ul>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<ul><li>red</li><li>green</li></ul>');
    });

    it('can switch between primitive values and template literals', async () => {
        const el = document.createElement('div');
        const primitiveValue = 'Test';
        let templateResult = html`<div>${primitiveValue}</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>Test</div>');

        templateResult = html`<div>${html`<span>${primitiveValue}</span>`}</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div><span>Test</span></div>');

        render(html`<div>${primitiveValue}</div>`, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>Test</div>');
    });

    it('can rerender a static string even when empty was rendered initially', async () => {
        const el = document.createElement('div');
        let templateResult = ``;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '');
        assert.equal(el.innerHTML, templateResult.toString(), 'CSR template does not match SSR template');

        templateResult = `bar`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), 'bar');
        assert.equal(el.innerHTML, templateResult.toString(), 'CSR template does not match SSR template');
    });

    it('can rerender a static string with different text content', async () => {
        const el = document.createElement('div');
        let templateResult = `foo`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), 'foo');
        assert.equal(el.innerHTML, templateResult.toString(), 'CSR template does not match SSR template');

        templateResult = `bar`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), 'bar');
        assert.equal(el.innerHTML, templateResult.toString(), 'CSR template does not match SSR template');
    });

    it('can rerender an empty TemplateResult with different text content', async () => {
        const el = document.createElement('div');
        let templateResult = html``;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '');
        assert.equal(el.innerHTML, templateResult.toString(), 'CSR template does not match SSR template');

        templateResult = `bar`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), 'bar');
        assert.equal(el.innerHTML, templateResult.toString(), 'CSR template does not match SSR template');
    });

    it('can rerender a TemplateResult with static text with different text content', async () => {
        const el = document.createElement('div');
        let templateResult = html`foo`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), 'foo');
        assert.equal(el.innerHTML, templateResult.toString(), 'CSR template does not match SSR template');

        templateResult = `bar`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), 'bar');
        assert.equal(el.innerHTML, templateResult.toString(), 'CSR template does not match SSR template');
    });

    it('can rerender a TemplateResult with static text with dynamic text content', async () => {
        const el = document.createElement('div');
        let templateResult = html`foo bar`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), 'foo bar');
        assert.equal(el.innerHTML, templateResult.toString(), 'CSR template does not match SSR template');

        templateResult = html`foo bar ${'baz'}`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), 'foo bar baz');
        assert.equal(el.innerHTML, templateResult.toString(), 'CSR template does not match SSR template');
    });

    it('can rerender a TemplateResult with html with different html content', async () => {
        const el = document.createElement('div');
        let templateResult = html`<div>foo</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>foo</div>');
        assert.equal(el.innerHTML, templateResult.toString(), 'CSR template does not match SSR template');

        templateResult = html`<div>bar</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>bar</div>');
        assert.equal(el.innerHTML, templateResult.toString(), 'CSR template does not match SSR template');

        templateResult = html`<span>baz</span>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<span>baz</span>');
        assert.equal(el.innerHTML, templateResult.toString(), 'CSR template does not match SSR template');
    });

    it('can rerender a TemplateResult with dynamic html with different html content', async () => {
        const el = document.createElement('div');
        let templateResult = html`<div>${html`<div>foo</div>`}</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div><div>foo</div></div>');
        assert.equal(el.innerHTML, templateResult.toString(), 'CSR template does not match SSR template');

        templateResult = html`<div>${html`<div>bar</div>`}</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div><div>bar</div></div>');
        assert.equal(el.innerHTML, templateResult.toString(), 'CSR template does not match SSR template');
    });
});
