import { assert } from '@open-wc/testing';
import { render } from '../../src/dom-parts/render.js';
import { html } from '../../src/TemplateElement.js';
import { stripCommentMarkers } from '../util/testing-helpers.js';
import { TextContentPart } from '../../src/dom-parts/TextContentPart.js';
import { parseTemplate, templateHash } from '../../src/dom-parts/parseTemplate.js';

const start = (templateResult) => `<!--t:${templateHash(templateResult.strings)}-->`;
const end = '<!--/t-->';
const clientHtml = (templateResult) => parseTemplate(templateResult.strings).clientHtml;
const assertSameAsServer = (el, templateResult) =>
    assert.equal(
        stripCommentMarkers(el.innerHTML),
        stripCommentMarkers(templateResult.toString()),
        'CSR template does not match SSR template',
    );

describe(`TextContentPart class`, () => {
    const descriptor = { kind: 'text', index: 0, marker: 0, tag: 'textarea', strings: ['', ' bar ', ''], span: 2 };

    it('writes the static pieces and the values of its element as one text', async () => {
        const el = document.createElement('textarea');
        const part = new TextContentPart(el, descriptor);
        part.update(['foo', 'baz']);
        assert.equal(el.textContent, 'foo bar baz');
        part.update(['x', 'baz']);
        assert.equal(el.textContent, 'x bar baz');
    });

    it('leaves server rendered content alone when it matches', async () => {
        const el = document.createElement('textarea');
        el.textContent = 'foo bar baz';
        const textNode = el.firstChild;
        const part = new TextContentPart(el, descriptor);
        part.update(['foo', 'baz']);
        assert.strictEqual(el.firstChild, textNode);
        part.update(['foo', 'qux']);
        assert.equal(el.textContent, 'foo bar qux');
    });
});

describe(`TextContentPart template parsing`, () => {
    it('puts the marker before the element and keeps the static text inside', async () => {
        const templateResult = html`<textarea>${'foo'} bar ${'baz'}</textarea>`;
        assert.equal(clientHtml(templateResult), `${start(templateResult)}<!--0--><textarea> bar </textarea>${end}`);
        assert.deepEqual(parseTemplate(templateResult.strings).descriptors, [
            { kind: 'text', index: 0, marker: 0, tag: 'textarea', strings: ['', ' bar ', ''], span: 2 },
        ]);
    });

    it('describes every raw text element of the template, not only the first', async () => {
        const templateResult = html`<textarea>${'foo'}</textarea><textarea>${'bar'}</textarea>`;
        assert.equal(
            clientHtml(templateResult),
            `${start(templateResult)}<!--0--><textarea></textarea><!--1--><textarea></textarea>${end}`,
        );
        assert.deepEqual(parseTemplate(templateResult.strings).descriptors, [
            { kind: 'text', index: 0, marker: 0, tag: 'textarea', strings: ['', ''], span: 1 },
            { kind: 'text', index: 1, marker: 1, tag: 'textarea', strings: ['', ''], span: 1 },
        ]);
    });

    it('finds an interpolation after a line break inside a raw text element', async () => {
        // prettier-ignore
        const templateResult = html`<style>
    .a { color: ${'red'}; }
</style>`;
        const [descriptor] = parseTemplate(templateResult.strings).descriptors;
        assert.equal(descriptor.kind, 'text');
        assert.equal(descriptor.tag, 'style');
        assert.deepEqual(descriptor.strings, ['\n    .a { color: ', '; }\n']);
    });

    it('recognises an end tag with whitespace before its closing bracket', async () => {
        // prettier-ignore
        const templateResult = html`<style>.a { color: ${'red'}; }</style
        ><div></div>`;
        assert.equal(parseTemplate(templateResult.strings).descriptors[0].kind, 'text');
    });

    it('hangs the text binding on the marker of the attribute bindings of the same element', async () => {
        // prettier-ignore
        const templateResult = html`<style media="${'screen'}">.a { color: ${'red'}; }</style>`;
        assert.equal(
            clientHtml(templateResult),
            `${start(templateResult)}<!--0--><style>.a { color: ; }</style>${end}`,
        );
        assert.deepEqual(
            parseTemplate(templateResult.strings).descriptors.map(({ kind, index, marker }) => [kind, index, marker]),
            [
                ['attribute', 0, 0],
                ['text', 1, 0],
            ],
        );
    });
});

describe(`TextContentPart template bindings`, () => {
    it('can have a single interpolation inside a raw text element', async () => {
        const el = document.createElement('div');
        const templateResult = html`<textarea>${'foo'}</textarea>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<textarea>foo</textarea>');
        assertSameAsServer(el, templateResult);
    });

    it('can have multiple interpolations inside a raw text element', async () => {
        const el = document.createElement('div');
        const templateResult = html`<textarea>${'foo'} bar ${'baz'}</textarea>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<textarea>foo bar baz</textarea>');
        assertSameAsServer(el, templateResult);
    });

    it('keeps the static text around a single interpolation', async () => {
        const el = document.createElement('div');
        // prettier-ignore
        const templateResult = html`<style>.a { color: ${'red'}; }</style>`;
        render(templateResult, el);
        assert.equal(el.querySelector('style').textContent, '.a { color: red; }');
        assertSameAsServer(el, templateResult);
    });

    it('renders every raw text element of the template, not only the first', async () => {
        const el = document.createElement('div');
        const templateResult = html`<textarea>${'foo'}</textarea><textarea>${'bar'}</textarea>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<textarea>foo</textarea><textarea>bar</textarea>');
        assertSameAsServer(el, templateResult);
    });

    it('renders an interpolation after a line break inside a raw text element', async () => {
        const el = document.createElement('div');
        // prettier-ignore
        const templateResult = html`<style>
    .a { color: ${'red'}; }
</style>`;
        render(templateResult, el);
        assert.equal(el.querySelector('style').textContent.trim(), '.a { color: red; }');
        assertSameAsServer(el, templateResult);
    });

    it('updates the content and its attributes', async () => {
        const el = document.createElement('div');
        // prettier-ignore
        const template = (media, color) => html`<style media="${media}">.a { color: ${color}; }</style>`;
        render(template('screen', 'red'), el);
        render(template('print', 'blue'), el);
        const style = el.querySelector('style');
        assert.equal(style.getAttribute('media'), 'print');
        assert.equal(style.textContent, '.a { color: blue; }');
    });
});
