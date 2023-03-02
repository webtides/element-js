import { fixture, assert } from '@open-wc/testing';
import { createTemplateString } from '../../src/renderer/vanilla/util/TemplateResult.js';

const html = (strings, ...expressions) => {
	let result = strings[0];

	for (let i = 1, l = strings.length; i < l; i++) {
		result += expressions[i - 1];
		result += strings[i];
	}

	return { strings, expressions };
};

describe(`TemplateResult.createTemplateString()`, () => {
	it('wraps the template in matching "template-part" comment nodes', async () => {
		const template = html`<div>Text</div>`;
		const templateString = createTemplateString(template.strings, 'dom-part-');
		assert.equal(templateString, '<!--template-part--><div>Text</div><!--/template-part-->');
	});

	it('leaves the template as is if no variables are present', async () => {
		const template = html`<div id="1" class="some-class">Text</div>`;
		const templateString = createTemplateString(template.strings, 'dom-part-');
		assert.equal(
			templateString,
			'<!--template-part--><div id="1" class="some-class">Text</div><!--/template-part-->',
		);
	});

	it('adds placeholders as comment nodes for child node variables', async () => {
		const template = html`<div>${'Text'}</div>`;
		const templateString = createTemplateString(template.strings, 'dom-part-');
		assert.equal(
			templateString,
			'<!--template-part--><div><!--dom-part-0--><!--/dom-part-0--></div><!--/template-part-->',
		);
	});

	it('adds placeholders as comment nodes before the node for attribute variables', async () => {
		const template = html`<div id="${1}" class="${'some-class'}">Text</div>`;
		const templateString = createTemplateString(template.strings, 'dom-part-');
		assert.equal(
			templateString,
			'<!--template-part--><!--dom-part-0:id--><!--dom-part-1:class--><div id="" class="">Text</div><!--/template-part-->',
		);
	});

	// TODO: what if attributes don't have quotes?! Test it!

	it('adds the correct amount of placeholders as comment nodes for each variable', async () => {
		const template = html`<div id="${1}" class="${'some-class'}">${'Text'}</div>`;
		const templateString = createTemplateString(template.strings, 'dom-part-');
		assert.equal(
			templateString,
			'<!--template-part--><!--dom-part-0:id--><!--dom-part-1:class--><div id="" class=""><!--dom-part-2--><!--/dom-part-2--></div><!--/template-part-->',
		);
	});
});
