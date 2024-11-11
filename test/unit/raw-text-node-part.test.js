import { fixture, assert, nextFrame, oneEvent } from '@open-wc/testing';
import { render } from '../../src/dom-parts/render.js';
import { html } from '../../src/TemplateElement.js';
import { stripCommentMarkers } from './template-bindings.test.js';
import { RawTextNodePart } from '../../src/dom-parts/RawTextNodePart.js';
import { convertStringToTemplate } from '../../src/util/DOMHelper.js';
import { createTemplateString } from '../../src/dom-parts/TemplateResult.js';

// TODO: this is copied and changed from template-result.test.js
export const stripWhitespace = (html) => html.replace(/\s+/g, ' ').replaceAll('> <', '><').trim();

describe(`RawTextNodePart class`, () => {
    it('stores a node to be processed from the comment marker node', async () => {
        const el = document.createElement('div');
        el.innerHTML = `<!--dom-part--><textarea></textarea><!--/dom-part-->`;
        const marker = el.childNodes[0];
        const node = el.childNodes[1];
        const part = new RawTextNodePart(marker, '');
        assert.equal(part.node, node);
    });

    it('updates its node with new string content', async () => {
        const el = document.createElement('div');
        el.innerHTML = `<!--dom-part-0/raw-text-node=\x03--><textarea></textarea>`;
        const marker = el.childNodes[0];
        const part = new RawTextNodePart(marker, '');
        assert.equal(stripCommentMarkers(el.textContent), '');
        part.update('foo bar baz');
        assert.equal(stripCommentMarkers(el.textContent), 'foo bar baz');
    });
});

describe(`RawTextNodePart template string parsing`, () => {
    it('adds placeholders as comment nodes before the node for text only nodes', async () => {
        const templateResult = html`<textarea>${'Text'}</textarea>`;
        const templateString = createTemplateString(templateResult.strings);
        assert.equal(
            stripWhitespace(templateString),
            '<!--template-part--><!--dom-part-0/raw-text-node=\x03--><textarea></textarea><!--/template-part-->',
        );
    });

    it('adds multiple placeholders as comment nodes before the node for text only nodes', async () => {
        const templateResult = html`<textarea>${'foo'} bar ${'baz'}</textarea>`;
        const templateString = createTemplateString(templateResult.strings);
        assert.equal(
            stripWhitespace(templateString),
            '<!--template-part--><!--dom-part-0/raw-text-node=\x03 bar \x03--><!--dom-part-1/raw-text-node=\x03 bar \x03--><textarea> bar </textarea><!--/template-part-->',
        );
    });
});

describe(`RawTextNodePart part creation`, () => {
    it('creates a raw-text-node part for an interpolation inside a text only element', async () => {
        const templateResult = html`<textarea>${'content'}</textarea>`;
        const documentFragment = convertStringToTemplate(templateResult.templateString);
        const childNodes = [...documentFragment.childNodes];
        const parts = templateResult.parseParts(childNodes);
        assert.deepEqual(parts, [{ type: 'raw-text-node', path: [2], initialValue: '\x03' }]);
    });

    it('creates multiple raw-text-node parts for multiple interpolations inside a text only element', async () => {
        const templateResult = html`<textarea>${'foo'} bar ${'baz'}</textarea>`;
        const documentFragment = convertStringToTemplate(templateResult.templateString);
        const childNodes = [...documentFragment.childNodes];
        const parts = templateResult.parseParts(childNodes);
        assert.deepEqual(parts, [
            { type: 'raw-text-node', path: [2], initialValue: '\x03 bar \x03' },
            { type: 'raw-text-node', path: [3], initialValue: '\x03 bar \x03' },
        ]);
    });
});

describe(`RawTextNodePart template bindings`, () => {
    it('can have a single interpolation inside a text only element', async () => {
        const el = document.createElement('div');
        const content = 'foo';
        const templateResult = html`<textarea>${content}</textarea>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<textarea>foo</textarea>');
        // TODO: make SSR work here as well
        // assert.equal(
        //     stripCommentMarkers(el.innerHTML),
        //     stripCommentMarkers(templateResult.toString()),
        //     'CSR template does not match SSR template',
        // );
    });

    it('can have multiple interpolations inside a text only element', async () => {
        const el = document.createElement('div');
        const templateResult = html`<textarea>${'foo'} bar ${'baz'}</textarea>`;
        render(templateResult, el);
        assert.equal(stripCommentMarkers(el.innerHTML), '<textarea>foo bar baz</textarea>');
        // TODO: make SSR work here as well
        // assert.equal(
        //     stripCommentMarkers(el.innerHTML),
        //     stripCommentMarkers(templateResult.toString()),
        //     'CSR template does not match SSR template',
        // );
    });
});
