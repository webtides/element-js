import { fixture, assert } from '@open-wc/testing';
import { html } from '../../src/dom-parts/html.js';
import { render } from '../../src/dom-parts/render.js';
import { parseTemplate, templateHash, ParseTemplateError } from '../../src/dom-parts/parseTemplate.js';
import { stripCommentMarkers } from '../util/testing-helpers.js';
import { defineDirective, Directive } from '../../src/util/Directive.js';

const directive = defineDirective(
    class extends Directive {
        stringify() {
            return 'from-directive=""';
        }
    },
);

/** the start marker of a template, it carries the hash of the literal */
const start = (templateResult) => `<!--t:${templateHash(templateResult.strings)}-->`;
const end = '<!--/t-->';
const descriptors = (templateResult) => parseTemplate(templateResult.strings).descriptors;
const clientHtml = (templateResult) => parseTemplate(templateResult.strings).clientHtml;
const withWarnings = (fn) => {
    const warnings = [];
    const original = console.warn;
    console.warn = (...args) => warnings.push(args);
    try {
        fn();
    } finally {
        console.warn = original;
    }
    return warnings;
};

describe('parseTemplate()', () => {
    it('wraps the template in template markers that carry the hash of the literal', () => {
        const templateResult = html`<div>Text</div>`;
        assert.equal(clientHtml(templateResult), `${start(templateResult)}<div>Text</div>${end}`);
        assert.deepEqual(descriptors(templateResult), []);
    });

    it('gives the same hash to the same literal text and another one to a different text', () => {
        assert.equal(templateHash(html`<p>${1}</p>`.strings), templateHash(html`<p>${2}</p>`.strings));
        assert.notEqual(templateHash(html`<p>${1}</p>`.strings), templateHash(html`<q>${1}</q>`.strings));
    });

    it('marks a child node interpolation with a start and an end marker', () => {
        const templateResult = html`<div>${'Text'}</div>`;
        assert.equal(clientHtml(templateResult), `${start(templateResult)}<div><!--0--><!--/0--></div>${end}`);
        assert.deepEqual(descriptors(templateResult), [{ kind: 'node', index: 0, marker: 0 }]);
    });

    it('puts one marker before an element with attribute interpolations and leaves those attributes out', () => {
        const templateResult = html`<div id="${1}" class="${'some'}">Text</div>`;
        assert.equal(clientHtml(templateResult), `${start(templateResult)}<!--0--><div>Text</div>${end}`);
        assert.deepEqual(descriptors(templateResult), [
            { kind: 'attribute', index: 0, marker: 0, name: 'id', strings: ['', ''], span: 1 },
            { kind: 'attribute', index: 1, marker: 0, name: 'class', strings: ['', ''], span: 1 },
        ]);
    });

    it('describes an attribute with several interpolations as one binding with its static pieces', () => {
        const templateResult = html`<div class="${'some'} other ${'class'}">Text</div>`;
        assert.deepEqual(descriptors(templateResult), [
            { kind: 'attribute', index: 0, marker: 0, name: 'class', strings: ['', ' other ', ''], span: 2 },
        ]);
    });

    it('keeps the static text around a single interpolation', () => {
        const templateResult = html`<a href="//foo.bar?param=${1}">Label</a>`;
        assert.deepEqual(descriptors(templateResult), [
            { kind: 'attribute', index: 0, marker: 0, name: 'href', strings: ['//foo.bar?param=', ''], span: 1 },
        ]);
    });

    it('keeps static attributes as they are written', () => {
        // prettier-ignore
        const templateResult = html`<div id='${1}' class="${'a'}" foo=${'b'} data-x='y' hidden>Text</div>`;
        assert.equal(
            clientHtml(templateResult),
            `${start(templateResult)}<!--0--><div data-x='y' hidden>Text</div>${end}`,
        );
    });

    it('numbers a marker by the first value it stands for', () => {
        const templateResult = html`<div id="${1}" class="${'some'}">${'Text'}</div>`;
        assert.equal(clientHtml(templateResult), `${start(templateResult)}<!--0--><div><!--2--><!--/2--></div>${end}`);
        assert.deepEqual(
            descriptors(templateResult).map(({ kind, index, marker }) => [kind, index, marker]),
            [
                ['attribute', 0, 0],
                ['attribute', 1, 0],
                ['node', 2, 2],
            ],
        );
    });

    it('marks a self closing element', () => {
        const templateResult = html`<input name="foo" value="${'bar'}" />`;
        assert.equal(clientHtml(templateResult), `${start(templateResult)}<!--0--><input name="foo" />${end}`);
    });

    it('describes an interpolation at an attribute position as a directive', () => {
        const templateResult = html`<div no-directive ${directive()}>Text</div>`;
        assert.equal(clientHtml(templateResult), `${start(templateResult)}<!--0--><div no-directive>Text</div>${end}`);
        assert.deepEqual(descriptors(templateResult), [{ kind: 'directive', index: 0, marker: 0 }]);
    });

    it('creates no descriptors for the interpolations of a nested template', () => {
        const templateResult = html`<div>${html`<div>${'Text'}</div>`}</div>`;
        assert.deepEqual(descriptors(templateResult), [{ kind: 'node', index: 0, marker: 0 }]);
    });

    it('rejects a boolean, property or event binding that is not the whole attribute value', () => {
        assert.throws(() => parseTemplate(html`<div ?a="${1} ${2}"></div>`.strings), ParseTemplateError, /whole value/);
        assert.throws(() => parseTemplate(html`<div .a="x${1}"></div>`.strings), ParseTemplateError, /whole value/);
        assert.throws(() => parseTemplate(html`<div @a="${1}y"></div>`.strings), ParseTemplateError, /whole value/);
    });

    it('rejects interpolations where no part can bind them', () => {
        assert.throws(() => parseTemplate(html`<!-- ${1} -->`.strings), ParseTemplateError, /comment/);
        assert.throws(() => parseTemplate(html`<${'div'}></div>`.strings), ParseTemplateError, /tag name/);
        assert.throws(
            () => parseTemplate(html`<div data-${'x'}="1"></div>`.strings),
            ParseTemplateError,
            /attribute name/,
        );
    });
});

describe('TemplateResult.renderInto()', () => {
    it('can render static strings', async () => {
        const el = document.createElement('div');
        let name = 'John';
        const templateResult = `<div>${name}</div>`;
        render(templateResult, el);
        assert.equal(el.innerHTML, '<div>John</div>');
    });

    it('can re-render and update between static strings and dynamic template results', async () => {
        const el = document.createElement('div');
        let templateResult = html`<div>${'1'}</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>1</div>');

        templateResult = `<div>${'2'}</div>`;
        render(templateResult, el);
        assert.equal(el.innerHTML, '<div>2</div>');

        templateResult = html`<div>${'3'}</div>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>3</div>');
    });

    it('gives the start marker the hash of the literal that is rendered after a template swap', async () => {
        const el = document.createElement('div');
        render(html`<p>${'a'}</p>`, el);
        const templateResult = html`<span>${'b'}</span>`;
        render(templateResult, el);
        assert.equal(el.innerHTML, templateResult.toString());
    });
});

describe('TemplateResult.toString()', () => {
    it('writes the template markers', async () => {
        const templateResult = html`<div>Text</div>`;
        assert.equal(templateResult.toString(), `${start(templateResult)}<div>Text</div>${end}`);
    });

    it('writes a child node value between its markers', async () => {
        const templateResult = html`<div>${'Text'}</div>`;
        assert.equal(templateResult.toString(), `${start(templateResult)}<div><!--0-->Text<!--/0--></div>${end}`);
    });

    it('writes the items of a list one after the other', async () => {
        const templateResult = html`<div>${['Text-1', 'Text-2']}</div>`;
        assert.equal(
            templateResult.toString(),
            `${start(templateResult)}<div><!--0-->Text-1Text-2<!--/0--></div>${end}`,
        );
    });

    it('writes nested templates with their own markers', async () => {
        const inner = (text) => html`${text}`;
        const templateResult = html`<div>${[inner('Text-1'), inner('Text-2')]}</div>`;
        const innerStart = start(inner(''));
        assert.equal(
            templateResult.toString(),
            `${start(
                templateResult,
            )}<div><!--0-->${innerStart}<!--0-->Text-1<!--/0-->${end}${innerStart}<!--0-->Text-2<!--/0-->${end}<!--/0--></div>${end}`,
        );
    });

    it('writes nothing for null', async () => {
        const templateResult = html`<div>${null}</div>`;
        assert.equal(templateResult.toString(), `${start(templateResult)}<div><!--0--><!--/0--></div>${end}`);
    });

    it('writes bound attributes into the tag, behind the element marker', async () => {
        const templateResult = html`<div id="${1}" class="${'some'}">Text</div>`;
        assert.equal(
            templateResult.toString(),
            `${start(templateResult)}<!--0--><div id="1" class="some">Text</div>${end}`,
        );
    });

    it('joins an attribute with several interpolations', async () => {
        const templateResult = html`<div id="${1}" not-class="${'some'} other ${'class'}">Text</div>`;
        assert.equal(
            templateResult.toString(),
            `${start(templateResult)}<!--0--><div id="1" not-class="some other class">Text</div>${end}`,
        );
    });

    it('writes every bound attribute with double quotes', async () => {
        // prettier-ignore
        const templateResult = html`<div id='${1}' class="${'some-class'}" foo=${'bar'}>Text</div>`;
        assert.equal(
            templateResult.toString(),
            `${start(templateResult)}<!--0--><div id="1" class="some-class" foo="bar">Text</div>${end}`,
        );
    });

    it('keeps the static text around a single interpolation', async () => {
        const templateResult = html`<a href="//foo.bar?param=${1}">Label</a>`;
        assert.equal(
            templateResult.toString(),
            `${start(templateResult)}<!--0--><a href="//foo.bar?param=1">Label</a>${end}`,
        );
    });

    it('writes the attributes and the child node value of one element', async () => {
        const templateResult = html`<div id="${1}" class="${'some'}">${'Text'}</div>`;
        assert.equal(
            templateResult.toString(),
            `${start(templateResult)}<!--0--><div id="1" class="some"><!--2-->Text<!--/2--></div>${end}`,
        );
    });

    it('writes a directive where it stands', async () => {
        const templateResult = html`<div ${directive()}>Directive</div>`;
        assert.equal(
            templateResult.toString(),
            `${start(templateResult)}<!--0--><div from-directive="">Directive</div>${end}`,
        );
    });

    it('writes a boolean attribute as name="" for true and leaves it out for false and the string "false"', async () => {
        const templateResult = html`<div ?disabled="${true}" ?hidden="${false}" ?open="${'false'}">Text</div>`;
        assert.equal(templateResult.toString(), `${start(templateResult)}<!--0--><div disabled="">Text</div>${end}`);
    });

    it('writes a property binding as the dash-case attribute with the value as JSON', async () => {
        const templateResult = html`<div .data="${{ foo: 'bar' }}" .sliderOptions="${{ gap: 16 }}">Text</div>`;
        assert.equal(
            templateResult.toString(),
            `${start(
                templateResult,
            )}<!--0--><div data="{&quot;foo&quot;:&quot;bar&quot;}" slider-options="{&quot;gap&quot;:16}">Text</div>${end}`,
        );
    });

    it('leaves out an attribute whose whole value is null or undefined', async () => {
        const templateResult = html`<div id="${null}" title="${undefined}" class="${'some'}">Text</div>`;
        assert.equal(templateResult.toString(), `${start(templateResult)}<!--0--><div class="some">Text</div>${end}`);
    });

    it('writes an object in an attribute as JSON', async () => {
        const templateResult = html`<div data-x="${{ a: 1 }}">x</div>`;
        assert.equal(
            templateResult.toString(),
            `${start(templateResult)}<!--0--><div data-x="{&quot;a&quot;:1}">x</div>${end}`,
        );
    });

    it('writes nothing for null among several interpolations of an attribute', async () => {
        const templateResult = html`<div class="${'a'} ${null} ${'b'}">x</div>`;
        assert.equal(templateResult.toString(), `${start(templateResult)}<!--0--><div class="a  b">x</div>${end}`);
    });

    it('writes nothing for an @event binding and for a listener on an on-attribute', async () => {
        const templateResult = html`<div @e="${() => {}}" onClick="${() => {}}" onClick="console.log('')">Text</div>`;
        assert.equal(
            templateResult.toString(),
            `${start(templateResult)}<!--0--><div onClick="console.log('')">Text</div>${end}`,
        );
    });

    it('writes an attribute that starts with "on" when the value is not a function', async () => {
        const templateResult = html`<div on="${'default'}" once="${'x'}" onClick="${() => {}}">Text</div>`;
        assert.equal(
            templateResult.toString(),
            `${start(templateResult)}<!--0--><div on="default" once="x">Text</div>${end}`,
        );
    });

    it('encodes text values', async () => {
        const templateResult = html`<p>${'<script>alert(1)</script>'}</p>`;
        assert.equal(stripCommentMarkers(templateResult.toString()), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    });

    it('writes the content of style and script verbatim and refuses an end tag in a value', async () => {
        // prettier-ignore
        const templateResult = html`<style>.a > .b { color: ${'red'}; }</style>`;
        assert.equal(
            templateResult.toString(),
            `${start(templateResult)}<!--0--><style>.a > .b { color: red; }</style>${end}`,
        );
        assert.throws(
            () =>
                html`<style>
                    ${'</style><script>x</script>'}
                </style>`.toString(),
            /<\/style/,
        );
    });

    it('encodes the content of textarea and title', async () => {
        const templateResult = html`<textarea>${'<b>'} bar ${'baz'}</textarea>`;
        assert.equal(stripCommentMarkers(templateResult.toString()), '<textarea>&lt;b&gt; bar baz</textarea>');
    });

    it('warns and writes an object child node value as text', async () => {
        const templateResult = html`<p>${{ a: 1 }}</p>`;
        let markup;
        const warnings = withWarnings(() => {
            markup = templateResult.toString();
        });
        assert.equal(warnings.length, 1);
        assert.equal(stripCommentMarkers(markup), '<p>[object Object]</p>');
    });
});

describe('TemplateResult SSR', () => {
    it('only hydrates server side rendered templates', async () => {
        const template = (text) => html`<div>${text}</div>`;
        const el = await fixture(`<div>${template('Foo').toString()}</div>`);
        const serverRenderedDiv = el.querySelector('div');
        render(template('Bar'), el);
        // the server rendered element is taken over, not rendered again, and the client value is applied
        assert.strictEqual(el.querySelector('div'), serverRenderedDiv);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>Bar</div>');
    });

    it('can update previously hydrated templates', async () => {
        const template = (text) => html`<div>${text}</div>`;
        const el = await fixture(`<div>${template('Foo').toString()}</div>`);
        render(template('Foo'), el);
        render(template('Bar'), el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<div>Bar</div>');
    });

    it('renders client side when the server rendered another literal', async () => {
        const el = await fixture(`<div>${html`<p>${'x'}</p>`.toString()}</div>`);
        const warnings = withWarnings(() => render(html`<span>${'y'}</span>`, el));
        assert.equal(warnings.length, 1);
        assert.include(warnings[0][0], 'do not match');
        assert.equal(stripCommentMarkers(el.innerHTML), '<span>y</span>');
    });
});
