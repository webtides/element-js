import { fixture, assert, nextFrame } from '@open-wc/testing';
import { render } from '../../../src/renderer/vanilla/util/render';

export const stripCommentMarkers = (html) =>
	html
		.replace(/<!--(\/?)(template-part|dom-part-\d+(:\w+)?)-->/g, '')
		.replace(/\s+/g, ' ')
		.replaceAll('> ', '>')
		.trim();

export const testTemplateBindings = function (name, templateTag, html, unsafeHTML) {
	describe(`template bindings for ${name}`, () => {
		it('creates the correct string from the literal', async () => {
			const el = document.createElement('div');
			render(html`<div class="parent"><div class="child">content</div></div>`, el);
			assert.equal(
				stripCommentMarkers(el.innerHTML),
				'<div class="parent"><div class="child">content</div></div>',
			);
		});

		it('parses variables as string from the literal', async () => {
			const el = document.createElement('div');
			let name = 'John';
			render(html`<div>Hello ${name}</div>`, el);
			assert.equal(stripCommentMarkers(el.innerHTML), '<div>Hello John</div>');
		});

		it('correctly sanitizes html input', async () => {
			const el = document.createElement('div');
			render(html`${'<strong>Unsafe HTML</strong>'}`, el);
			assert.equal(stripCommentMarkers(el.innerHTML), '&lt;strong&gt;Unsafe HTML&lt;/strong&gt;');
		});

		// TODO:
		/*it('allows unsafe html input with the "unsafeHTML" directive', async () => {
			const el = document.createElement('div');
			render(html`${unsafeHTML(`<strong>Unsafe HTML</strong>`)}`, el);
			assert.equal(stripCommentMarkers(el.innerHTML), '<strong>Unsafe HTML</strong>');
		});*/

		it('can have functions as bindings', async () => {
			const el = document.createElement('div');
			const name = () => 'John';
			render(html`<div>Hello ${name}</div>`, el);
			assert.equal(stripCommentMarkers(el.innerHTML), '<div>Hello John</div>');
		});

		it('can render bindings with html literals', async () => {
			const el = document.createElement('div');
			let nested = html`<div class="nested"></div>`;
			render(html`<div>${nested}</div>`, el);
			assert.equal(stripCommentMarkers(el.innerHTML), '<div><div class="nested"></div></div>');
		});

		it('correctly parses arrays of literals', async () => {
			const el = document.createElement('div');
			let list = [html`<div>1</div>`, html`<div>2</div>`, html`<div>3</div>`];
			render(html`<div>${list}</div>`, el);
			assert.equal(stripCommentMarkers(el.innerHTML), '<div><div>1</div><div>2</div><div>3</div></div>');
		});

		// TODO: fix and add test back in...
		/*it('correctly sanitizes an array of unsafe strings', async () => {
			const el = document.createElement('div');
			const parts = [`<strong>First part</strong>`, `<strong>Second part</strong>`];
			render(html`<div>${parts}</div>`, el);
			assert.equal(
				stripCommentMarkers(el.innerHTML),
				'<div>&lt;strong&gt;First part&lt;/strong&gt;&lt;strong&gt;Second part&lt;/strong&gt;</div>',
			);
		});*/

		// TODO: fix and add test back in...
		/*it('allows unsafe html input with the "unsafeHTML" directive in arrays', async () => {
			const el = await fixture(`<${templateTag}></${templateTag}>`);

			const parts = [unsafeHTML(`<strong>First part</strong>`), unsafeHTML(`<strong>Second part</strong>`)];
			await el.updateTemplate(html`${parts}`);

			assert.lightDom.equal(el, '<strong>First part</strong><strong>Second part</strong>');
		});*/

		it('can render single bindings inside attributes', async () => {
			const el = document.createElement('div');
			const active = true;
			render(html`<a class="${active ? 'is-active' : ''}">Label</a>`, el);
			assert.equal(stripCommentMarkers(el.innerHTML), '<a class="is-active">Label</a>');
		});

		// TODO: fix and add test back in...
		/*it('can render bindings inside attributes between static strings', async () => {
			const el = document.createElement('div');
			const active = true;
			render(html`<a class="link ${active ? 'is-active' : ''}">Label</a>`, el);
			assert.equal(stripCommentMarkers(el.innerHTML), '<a class="link is-active">Label</a>');
		});*/

		// TODO: fix and add test back in...
		/*it('can render multiple bindings inside attributes', async () => {
			const el = await fixture(`<${templateTag}></${templateTag}>`);
			const active = true;
			const highlight = true;
			await el.updateTemplate(
				html`<a class="link ${active ? 'is-active' : ''} ${highlight ? 'is-highlight' : ''}">Label</a>`,
			);
			assert.lightDom.equal(el, '<a class="link is-active is-highlight">Label</a>');
		});*/

		it('can render conditional nested html templates', async () => {
			const el = document.createElement('div');
			const nested = true;
			render(html`<div>${nested ? html`<div class="nested">nested</div>` : html``}</div>`, el);
			assert.equal(stripCommentMarkers(el.innerHTML), '<div><div class="nested">nested</div></div>');
		});

		it('can render empty conditional html templates', async () => {
			const el = document.createElement('div');
			const nested = false;
			render(html`<div>${nested ? html`<div class="nested">nested</div>` : html``}</div>`, el);
			assert.equal(stripCommentMarkers(el.innerHTML), '<div></div>');
		});

		it('can render lists with looped bindings', async () => {
			const el = document.createElement('div');
			const colors = ['red', 'green', 'blue'];
			render(
				html`<ul>
					${colors.map((color) => html`<li>${color}</li>`)}
				</ul>`,
				el,
			);
			assert.equal(stripCommentMarkers(el.innerHTML), '<ul><li>red</li><li>green</li><li>blue</li></ul>');
		});
	});
};
