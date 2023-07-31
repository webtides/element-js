import { fixture, assert, nextFrame, oneEvent } from '@open-wc/testing';
import { render } from '../../../src/renderer/vanilla/util/render';

// TODO: for testing that SSR and CSR will render the same thing, it would be good to test with whitespace and comment markers to make sure that they perfectly match!
export const stripCommentMarkers = (html) =>
	html
		.replace(/<!--(\/)?(dom|template)-part(-\d+)?(:(@|.|\?)?\w+(=.*)?)?-->/g, '')
		.replace(/\s+/g, ' ')
		.replaceAll('> ', '>')
		.trim();

export const testTemplateBindings = function (name, templateTag, html, unsafeHTML) {
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

			// TODO: SSR is rendering properties as attributes...
			// assert.equal(
			// 	stripCommentMarkers(el.innerHTML),
			// 	stripCommentMarkers(templateResult.toString()),
			// 	'CSR template does not match SSR template',
			// );
		});

		it('can render special @event bindings inside attributes', async () => {
			const el = document.createElement('div');
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
				stripCommentMarkers(el.innerHTML.replace('onclick', 'onClick').replace('</a>', '</a >')), // TODO: why?!
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

		// TODO: it is actually working but somehow in the tests the DOM element won't update...
		// it('can remove items from lists with looped bindings', async () => {
		// 	const el = document.createElement('div');
		// 	const colors = ['red', 'green', 'blue'];
		// 	let templateResult = html`<ul>
		// 		${colors.map((color) => html`<li>${color}</li>`)}
		// 	</ul>`;
		// 	render(templateResult, el);
		// 	assert.equal(stripCommentMarkers(el.innerHTML), '<ul><li>red</li><li>green</li><li>blue</li></ul>');
		// 	assert.equal(
		// 		stripCommentMarkers(el.innerHTML),
		// 		stripCommentMarkers(templateResult.toString()),
		// 		'CSR template does not match SSR template',
		// 	);
		//
		// 	templateResult = html`<ul>
		// 		${['red', 'green'].map((color) => html`<li>${color}</li>`)}
		// 	</ul>`;
		// 	render(templateResult, el);
		// 	assert.equal(stripCommentMarkers(el.innerHTML), '<ul><li>red</li><li>green</li></ul>');
		// });

		// TODO: it is actually working but somehow in the tests the DOM element won't update...
		// it('can switch between primitive values and template literals', async () => {
		// 	const el = document.createElement('div');
		// 	const primitiveValue = 'Test';
		// 	let templateResult = html`<div>${primitiveValue}</div>`;
		// 	render(templateResult, el);
		// 	assert.equal(stripCommentMarkers(el.innerHTML), '<div>Test</div>');
		//
		// 	templateResult = html`<div>${html`<span>${primitiveValue}</span>`}</div>`;
		// 	render(templateResult, el);
		// 	assert.equal(stripCommentMarkers(el.innerHTML), '<div><span>Test</span></div>');
		//
		// 	render(html`<div>${primitiveValue}</div>`, el);
		// 	assert.equal(stripCommentMarkers(el.innerHTML), '<div>Test</div>');
		// });
	});
};
