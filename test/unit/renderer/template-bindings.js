import { fixture, assert, nextFrame } from '@open-wc/testing';
import { render } from '../../../src/renderer/vanilla/util/render';

export const stripCommentMarkers = (html) =>
	html
		.replace(/<!--(\/)?(dom|template)-part(-\d+)?(:\w+(=.*)?)?-->/g, '')
		.replace(/\s+/g, ' ')
		.replaceAll('> ', '>')
		.trim();

export const testTemplateBindings = function (name, templateTag, html, unsafeHTML) {
	// TODO: for testing that SSR and CSR will render the same thing, it would be good to test with whitespace and comment markers to make sure that they perfectly match!

	describe(`template bindings for ${name}`, () => {
		it('creates the correct string from the literal', async () => {
			const el = document.createElement('div');
			const templateResult = html`<div class="parent"><div class="child">content</div></div>`;
			render(templateResult, el);
			assert.equal(
				stripCommentMarkers(el.innerHTML),
				'<div class="parent"><div class="child">content</div></div>',
			);
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

		it('correctly sanitizes html input', async () => {
			const el = document.createElement('div');
			const templateResult = html`${'<strong>Unsafe HTML</strong>'}`;
			render(templateResult, el);
			assert.equal(stripCommentMarkers(el.innerHTML), '&lt;strong&gt;Unsafe HTML&lt;/strong&gt;');
			assert.equal(
				stripCommentMarkers(el.innerHTML),
				stripCommentMarkers(templateResult.toString()),
				'CSR template does not match SSR template',
			);
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

		// TODO: add ?|.|@|on* attributes tests

		/*it('can render special boolean bindings inside attributes', async () => {
			const el = document.createElement('div');
			let hidden = true;
			let disabled = false;
			const templateResult = html`<a ?hidden="${hidden}" ?disabled="${disabled}">Label</a>`;
			render(templateResult, el);
			assert.equal(stripCommentMarkers(el.innerHTML), '<a hidden >Label</a>');
			assert.equal(
				stripCommentMarkers(el.innerHTML),
				stripCommentMarkers(templateResult.toString()),
				'CSR template does not match SSR template',
			);
		});*/

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

		// TODO:
		/*it('can switch between primitive values and template literals', async () => {
			const el = document.createElement('div');
			const primitiveValue = 'Test';
			render(html`<div>${primitiveValue}</div>`, el);
			assert.equal(stripCommentMarkers(el.innerHTML), '<div>Test</div>');

			render(html`<div>${html`<span>${primitiveValue}</span>`}</div>`, el);
			assert.equal(stripCommentMarkers(el.innerHTML), '<div><span>Test</span></div>');

			render(html`<div>${primitiveValue}</div>`, el);
			assert.equal(stripCommentMarkers(el.innerHTML), '<div>Test</div>');
		});*/
	});
};
