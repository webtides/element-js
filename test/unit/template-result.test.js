import { fixture, assert } from '@open-wc/testing';
import { createTemplateString } from '../../src/renderer/vanilla/util/TemplateResult.js';
import { html } from '../../src/renderer/vanilla/util/html.js';
import { convertStringToTemplate } from '../../src/util/DOMHelper';

export const stripWhitespace = (html) => html.replace(/\s+/g, ' ').replaceAll('> ', '>').trim();

describe(`TemplateResult.createTemplateString()`, () => {
	it('wraps the template in matching "template-part" comment nodes', async () => {
		const templateResult = html`<div>Text</div>`;
		const templateString = createTemplateString(templateResult.strings);
		assert.equal(stripWhitespace(templateString), '<!--template-part--><div>Text</div><!--/template-part-->');
	});

	it('leaves the template as is if no variables are present', async () => {
		const templateResult = html`<div id="1" class="some-class">Text</div>`;
		const templateString = createTemplateString(templateResult.strings);
		assert.equal(
			stripWhitespace(templateString),
			'<!--template-part--><div id="1" class="some-class">Text</div><!--/template-part-->',
		);
	});

	it('adds placeholders as comment nodes for child node variables', async () => {
		const templateResult = html`<div>${'Text'}</div>`;
		const templateString = createTemplateString(templateResult.strings);
		assert.equal(
			stripWhitespace(templateString),
			'<!--template-part--><div><!--dom-part-0--><!--/dom-part-0--></div><!--/template-part-->',
		);
	});

	it('adds placeholders as comment nodes before the node for attribute variables', async () => {
		const templateResult = html`<div id="${1}" class="${'some'}">Text</div>`;
		const templateString = createTemplateString(templateResult.strings);
		assert.equal(
			stripWhitespace(templateString),
			'<!--template-part--><!--dom-part-0:id=\x03--><!--dom-part-1:class=\x03--><div id="" class="">Text</div><!--/template-part-->',
		);
	});

	it('adds placeholders as comment nodes before the node for attribute variables for self closing elements', async () => {
		const templateResult = html`<input name="foo" value="${'bar'}" />`;
		const templateString = createTemplateString(templateResult.strings);
		assert.equal(
			stripWhitespace(templateString),
			'<!--template-part--><!--dom-part-0:value=\x03--><input name="foo" value="" /><!--/template-part-->',
		);
	});

	it('adds multiple placeholders as comment nodes before the node for attributes with multiple variables', async () => {
		const templateResult = html`<div id="${1}" class="${'some'} other ${'class'}">Text</div>`;
		const templateString = createTemplateString(templateResult.strings);
		assert.equal(
			stripWhitespace(templateString),
			'<!--template-part--><!--dom-part-0:id=\x03--><!--dom-part-1:class=\x03 other \x03--><!--dom-part-2:class=\x03 other \x03--><div id="" class=" other ">Text</div><!--/template-part-->',
		);
	});

	it('can leave (comment) placeholders in attribute values', async () => {
		const templateResult = html`<div id="${1}" class="${'some'} other ${'class'}">Text</div>`;
		const templateString = createTemplateString(templateResult.strings, '\x03');
		assert.equal(
			stripWhitespace(templateString),
			'<!--template-part--><!--dom-part-0:id=\x03--><!--dom-part-1:class=\x03 other \x03--><!--dom-part-2:class=\x03 other \x03--><div id="\x03" class="\x03 other \x03">Text</div><!--/template-part-->',
		);
	});

	it('can use double, single or no quotes for attributes', async () => {
		// prettier-ignore
		const templateResult = html`<div id='${1}' class="${'some-class'}" foo=${'bar'}>Text</div>`;
		const templateString = createTemplateString(templateResult.strings, '\x03');
		assert.equal(
			stripWhitespace(templateString),
			'<!--template-part--><!--dom-part-0:id=\x03--><!--dom-part-1:class=\x03--><!--dom-part-2:foo=\x03--><div id=\'\x03\' class="\x03" foo=\x03>Text</div><!--/template-part-->',
		);
	});

	it('adds the correct amount of placeholders as comment nodes for each variable', async () => {
		const templateResult = html`<div id="${1}" class="${'some'}">${'Text'}</div>`;
		const templateString = createTemplateString(templateResult.strings);
		assert.equal(
			stripWhitespace(templateString),
			'<!--template-part--><!--dom-part-0:id=\x03--><!--dom-part-1:class=\x03--><div id="" class=""><!--dom-part-2--><!--/dom-part-2--></div><!--/template-part-->',
		);
	});
});

describe('TemplateResult.parseParts()', () => {
	it('creates no parts if no comment markers are present', async () => {
		const templateResult = html`<div>Text</div>`;
		const documentFragment = convertStringToTemplate(templateResult.templateString);
		const childNodes = [...documentFragment.childNodes];
		const parts = templateResult.parseParts(childNodes);
		assert.deepEqual(parts, []);
	});

	it('creates a node part for text interpolation inside a node', async () => {
		const templateResult = html`<div>${'Text'}</div>`;
		const documentFragment = convertStringToTemplate(templateResult.templateString);
		const childNodes = [...documentFragment.childNodes];
		const parts = templateResult.parseParts(childNodes);
		assert.deepEqual(parts, [{ type: 'node', path: [1, 2], parts: [] }]);
	});

	it('creates an attribute part for an interpolation inside an attribute', async () => {
		const templateResult = html`<div class="${'active'}">Text</div>`;
		const documentFragment = convertStringToTemplate(templateResult.templateString);
		const childNodes = [...documentFragment.childNodes];
		const parts = templateResult.parseParts(childNodes);
		assert.deepEqual(parts, [{ type: 'attribute', path: [2], name: 'class', initialValue: '\x03' }]);
	});

	it('creates multiple attribute parts for interpolations inside an attributes', async () => {
		const templateResult = html`<div id="${1}" class="${'active'}">Text</div>`;
		const documentFragment = convertStringToTemplate(templateResult.templateString);
		const childNodes = [...documentFragment.childNodes];
		const parts = templateResult.parseParts(childNodes);
		assert.deepEqual(parts, [
			{ type: 'attribute', path: [2], name: 'id', initialValue: '\x03' },
			{ type: 'attribute', path: [4], name: 'class', initialValue: '\x03' },
		]);
	});

	it('creates multiple attribute parts for interpolations inside an one attributes', async () => {
		const templateResult = html`<div class="${'some'} other ${'name'}">Text</div>`;
		const documentFragment = convertStringToTemplate(templateResult.templateString);
		const childNodes = [...documentFragment.childNodes];
		const parts = templateResult.parseParts(childNodes);
		assert.deepEqual(parts, [
			{ type: 'attribute', path: [2], name: 'class', initialValue: '\x03 other \x03' },
			{ type: 'attribute', path: [3], name: 'class', initialValue: '\x03 other \x03' },
		]);
	});
});

describe('TemplateResult.toString()', () => {
	it('wraps the template in matching "template-part" comment nodes', async () => {
		const templateResult = html`<div>Text</div>`;
		assert.equal(
			stripWhitespace(templateResult.toString()),
			'<!--template-part--><div>Text</div><!--/template-part-->',
		);
	});

	it('leaves the template as is if no variables are present', async () => {
		const templateResult = html`<div id="1" class="some-class">Text</div>`;
		assert.equal(
			stripWhitespace(templateResult.toString()),
			'<!--template-part--><div id="1" class="some-class">Text</div><!--/template-part-->',
		);
	});

	it('adds placeholders as comment nodes for child node variables', async () => {
		const templateResult = html`<div>${'Text'}</div>`;
		assert.equal(
			stripWhitespace(templateResult.toString()),
			'<!--template-part--><div><!--dom-part-0-->Text<!--/dom-part-0--></div><!--/template-part-->',
		);
	});

	it('adds placeholders as comment nodes before the node for attribute variables', async () => {
		const templateResult = html`<div id="${1}" class="${'some'}">Text</div>`;
		assert.equal(
			stripWhitespace(templateResult.toString()),
			'<!--template-part--><!--dom-part-0:id=\x03--><!--dom-part-1:class=\x03--><div id="1" class="some">Text</div><!--/template-part-->',
		);
	});

	it('adds multiple placeholders as comment nodes before the node for attributes with multiple variables', async () => {
		const templateResult = html`<div id="${1}" class="${'some'} other ${'class'}">Text</div>`;
		assert.equal(
			stripWhitespace(templateResult.toString()),
			'<!--template-part--><!--dom-part-0:id=\x03--><!--dom-part-1:class=\x03 other \x03--><!--dom-part-2:class=\x03 other \x03--><div id="1" class="some other class">Text</div><!--/template-part-->',
		);
	});

	it('can use double, single or no quotes for attributes', async () => {
		// prettier-ignore
		const templateResult = html`<div id='${1}' class="${'some-class'}" foo=${'bar'}>Text</div>`;
		assert.equal(
			stripWhitespace(templateResult.toString()),
			'<!--template-part--><!--dom-part-0:id=\x03--><!--dom-part-1:class=\x03--><!--dom-part-2:foo=\x03--><div id=\'1\' class="some-class" foo=bar>Text</div><!--/template-part-->',
		);
	});

	it('adds the correct amount of placeholders as comment nodes for each variable', async () => {
		const templateResult = html`<div id="${1}" class="${'some'}">${'Text'}</div>`;
		assert.equal(
			stripWhitespace(templateResult.toString()),
			'<!--template-part--><!--dom-part-0:id=\x03--><!--dom-part-1:class=\x03--><div id="1" class="some"><!--dom-part-2-->Text<!--/dom-part-2--></div><!--/template-part-->',
		);
	});

	it('evaluates boolean attributes correctly', async () => {
		const templateResult = html`<div ?disabled="${true}" ?hidden="${false}">Text</div>`;
		assert.equal(
			stripWhitespace(templateResult.toString()),
			'<!--template-part--><!--dom-part-0:?disabled=\x03--><!--dom-part-1:?hidden=\x03--><div disabled="">Text</div><!--/template-part-->',
		);
	});

	it('evaluates property attributes as stringified values', async () => {
		const templateResult = html`<div .data="${{ foo: 'bar' }}">Text</div>`;
		// TODO: make sure that this is the correct and wanted behaviour?! Because in CSR we do not render it as an attribute
		assert.equal(
			stripWhitespace(templateResult.toString()),
			'<!--template-part--><!--dom-part-0:.data=\x03--><div data="{&quot;foo&quot;:&quot;bar&quot;}">Text</div><!--/template-part-->',
		);
	});

	it('evaluates @event and onEvent attributes as nothing', async () => {
		const templateResult = html`<div @e="${() => {}}" onClick="${() => {}}" onClick="console.log('')">Text</div>`;
		assert.equal(
			stripWhitespace(templateResult.toString()),
			'<!--template-part--><!--dom-part-0:@e=\x03--><!--dom-part-1:onClick=\x03--><div onClick="console.log(\'\')">Text</div><!--/template-part-->',
		);
	});
});
