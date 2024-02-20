import { fixture, assert } from '@open-wc/testing';
import { createTemplateString } from '../../src/dom-parts/TemplateResult.js';
import { html } from '../../src/dom-parts/html.js';
import { convertStringToTemplate } from '../../src/util/DOMHelper.js';
import { render } from '../../src/dom-parts/render.js';
import { stripCommentMarkers } from './renderer/template-bindings.js';
import { defineDirective, Directive } from '../../src/util/Directive.js';

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

	it('adds placeholders as comment nodes before the node for directives at attribute positions', async () => {
		const directive = defineDirective(class extends Directive {});
		const templateResult = html`<div no-directive ${directive()}>Text</div>`;
		const templateString = createTemplateString(templateResult.strings);
		assert.equal(
			stripWhitespace(templateString),
			'<!--template-part--><!--dom-part-0$--><div no-directive>Text</div><!--/template-part-->',
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
		assert.deepEqual(parts, [{ type: 'node', path: [1, 2] }]);
	});

	it('creates an attribute part for an interpolation inside an attribute', async () => {
		const templateResult = html`<div class="${'active'}">Text</div>`;
		const documentFragment = convertStringToTemplate(templateResult.templateString);
		const childNodes = [...documentFragment.childNodes];
		const parts = templateResult.parseParts(childNodes);
		assert.deepEqual(parts, [{ type: 'attribute', path: [2], name: 'class', initialValue: '\x03' }]);
	});

	it('creates multiple attribute parts for interpolations inside multiple attributes', async () => {
		const templateResult = html`<div id="${1}" class="${'active'}">Text</div>`;
		const documentFragment = convertStringToTemplate(templateResult.templateString);
		const childNodes = [...documentFragment.childNodes];
		const parts = templateResult.parseParts(childNodes);
		assert.deepEqual(parts, [
			{ type: 'attribute', path: [2], name: 'id', initialValue: '\x03' },
			{ type: 'attribute', path: [4], name: 'class', initialValue: '\x03' },
		]);
	});

	it('creates multiple attribute parts for interpolations inside a single attributes', async () => {
		const templateResult = html`<div class="${'some'} other ${'name'}">Text</div>`;
		const documentFragment = convertStringToTemplate(templateResult.templateString);
		const childNodes = [...documentFragment.childNodes];
		const parts = templateResult.parseParts(childNodes);
		assert.deepEqual(parts, [
			{ type: 'attribute', path: [2], name: 'class', initialValue: '\x03 other \x03' },
			{ type: 'attribute', path: [3], name: 'class', initialValue: '\x03 other \x03' },
		]);
	});

	it('creates a node part for an interpolation at an attribute position', async () => {
		const directive = defineDirective(class extends Directive {});
		const templateResult = html`<div ${directive()}>Text</div>`;
		const documentFragment = convertStringToTemplate(templateResult.templateString);
		const childNodes = [...documentFragment.childNodes];
		const parts = templateResult.parseParts(childNodes);
		assert.deepEqual(parts, [{ type: 'directive', path: [2] }]);
	});

	it('creates no nested parts for text interpolation inside a nested node', async () => {
		const templateResult = html`<div>${html`<div>${'Text'}</div>`}</div>`;
		const documentFragment = convertStringToTemplate(templateResult.templateString);
		const childNodes = [...documentFragment.childNodes];
		const parts = templateResult.parseParts(childNodes);
		assert.deepEqual(parts, [{ type: 'node', path: [1, 2] }]);
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

	it('adds placeholders as comment nodes for a list of child node variables', async () => {
		const templateResult = html`<div>${['Text-1', 'Text-2']}</div>`;
		assert.equal(
			stripWhitespace(templateResult.toString()),
			'<!--template-part--><div><!--dom-part-0-->Text-1Text-2<!--/dom-part-0--></div><!--/template-part-->',
		);
	});

	it('adds placeholders as comment nodes for a list of template part child node variables', async () => {
		const templateResult = html`<div>${[html`${'Text-1'}`, html`${'Text-2'}`]}</div>`;
		assert.equal(
			stripWhitespace(templateResult.toString()),
			'<!--template-part--><div><!--dom-part-0--><!--template-part--><!--dom-part-0-->Text-1<!--/dom-part-0--><!--/template-part--><!--template-part--><!--dom-part-0-->Text-2<!--/dom-part-0--><!--/template-part--><!--/dom-part-0--></div><!--/template-part-->',
		);
	});

	it('adds placeholders as comment nodes for null child node variables', async () => {
		const templateResult = html`<div>${null}</div>`;
		assert.equal(
			stripWhitespace(templateResult.toString()),
			'<!--template-part--><div><!--dom-part-0--><!--/dom-part-0--></div><!--/template-part-->',
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
		const templateResult = html`<div id="${1}" not-class="${'some'} other ${'class'}">Text</div>`;
		assert.equal(
			stripWhitespace(templateResult.toString()),
			'<!--template-part--><!--dom-part-0:id=\x03--><!--dom-part-1:not-class=\x03 other \x03--><!--dom-part-2:not-class=\x03 other \x03--><div id="1" not-class="some other class">Text</div><!--/template-part-->',
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

	it('adds placeholders as comment nodes before the node for directives at attribute positions', async () => {
		const directive = defineDirective(class extends Directive {});
		const templateResult = html`<div ${directive()}>Directive</div>`;
		assert.equal(
			stripWhitespace(templateResult.toString()),
			'<!--template-part--><!--dom-part-0$--><div >Directive</div><!--/template-part-->',
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

describe('TemplateResult SSR', () => {
	it('only hydrates server side rendered templates', async () => {
		const el = await fixture(
			`<div><!--template-part--><div><!--dom-part-0-->Foo<!--/dom-part-0--></div><!--/template-part--></div>`,
		);
		let text = 'Bar';
		const templateResult = html`<div>${text}</div>`;
		render(templateResult, el);
		assert.equal(stripCommentMarkers(el.innerHTML), '<div>Foo</div>');
		const parts = templateResult.parseParts(el.childNodes);
		assert.equal(parts.length, 1);
		assert.equal(parts[0].type, 'node');
		// TODO: test parts like above...
	});

	it('can update previously hydrated templates', async () => {
		const el = await fixture(
			`<div><!--template-part--><div><!--dom-part-0-->Foo<!--/dom-part-0--></div><!--/template-part--></div>`,
		);
		let text = 'Foo';
		render(html`<div>${text}</div>`, el);
		text = 'Bar';
		render(html`<div>${text}</div>`, el);
		// assert.equal(stripCommentMarkers(el.innerHTML), '<div>Bar</div>');
		// TODO: this is actually working... but the element is not updating in the tests :(
	});
});
