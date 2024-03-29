import { fixture, assert } from '@open-wc/testing';

export const testTemplateBindings = function (name, templateTag, html, unsafeHTML) {
	describe(`template bindings for ${name}`, () => {
		it('creates the correct string from the literal', async () => {
			const el = await fixture(`<${templateTag}></${templateTag}>`);

			await el.updateTemplate(html`<div class="parent"><div class="child">content</div></div>`);

			assert.lightDom.equal(el, '<div class="parent"><div class="child">content</div></div>');
		});

		it('parses variables as string from the literal', async () => {
			const el = await fixture(`<${templateTag}></${templateTag}>`);

			let name = 'John';
			await el.updateTemplate(html`<div>Hello ${name}</div>`);

			assert.lightDom.equal(el, '<div>Hello John</div>');
		});

		if (name !== 'lit') {
			// TODO: for some reason the lit html literal does not sanitize...
			it('correctly sanitizes html input', async () => {
				const el = await fixture(`<${templateTag}></${templateTag}>`);

				await el.updateTemplate(html`${`<strong>Unsafe HTML</strong>`}`);

				assert.lightDom.equal(el, '$lt;strong$gt;Unsafe HTML$lt;/strong$gt;');
			});
		}

		it('allows unsafe html input with the "unsafeHTML" directive', async () => {
			const el = await fixture(`<${templateTag}></${templateTag}>`);

			await el.updateTemplate(html`${unsafeHTML(`<strong>Unsafe HTML</strong>`)}`);

			assert.lightDom.equal(el, '<strong>Unsafe HTML</strong>');
		});

		it('can have functions as bindings', async () => {
			const el = await fixture(`<${templateTag}></${templateTag}>`);

			const name = () => 'John';
			await el.updateTemplate(html`<div>Hello ${name()}</div>`);

			assert.lightDom.equal(el, '<div>Hello John</div>');
		});

		it('can render bindings with html literals', async () => {
			const el = await fixture(`<${templateTag}></${templateTag}>`);

			let nested = html`<div class="nested"></div>`;
			await el.updateTemplate(html`<div>${nested}</div>`);

			assert.lightDom.equal(el, '<div><div class="nested"></div></div>');
		});

		it('correctly parses arrays of literals', async () => {
			const el = await fixture(`<${templateTag}></${templateTag}>`);

			let list = [html`<div>1</div>`, html`<div>2</div>`, html`<div>3</div>`];
			await el.updateTemplate(html`<div>${list}</div>`);

			assert.lightDom.equal(el, '<div><div>1</div><div>2</div><div>3</div></div>');
		});

		if (name !== 'lit') {
			// TODO: for some reason the lit html literal does not sanitize...
			it('correctly parses an array of unsafe strings', async () => {
				const el = await fixture(`<${templateTag}></${templateTag}>`);

				const parts = [`<strong>First part</strong>`, `<strong>Second part</strong>`];
				await el.updateTemplate(html`${parts}`);

				assert.lightDom.equal(
					el,
					'$lt;strong$gt;First part$lt;/strong$gt;$lt;strong$gt;Second part$lt;/strong$gt;',
				);
			});
		}

		it('allows unsafe html input with the "unsafeHTML" directive in arrays', async () => {
			const el = await fixture(`<${templateTag}></${templateTag}>`);

			const parts = [unsafeHTML(`<strong>First part</strong>`), unsafeHTML(`<strong>Second part</strong>`)];
			await el.updateTemplate(html`${parts}`);

			assert.lightDom.equal(el, '<strong>First part</strong><strong>Second part</strong>');
		});

		if (name !== 'lit') {
			// TODO: this should actually work for lit-html but it crashes...
			it('can render bindings as node attributes', async () => {
				const el = await fixture(`<${templateTag}></${templateTag}>`);

				const disabled = true;
				await el.updateTemplate(html`<button ${disabled ? 'disabled' : ''}>Label</button>`);

				assert.lightDom.equal(el, '<button disabled>Label</button>');
			});

			it('can update attribute bindings', async () => {
				const el = await fixture(`<${templateTag}></${templateTag}>`);

				const disabled = true;
				let hidden = true;
				await el.updateTemplate(
					html`<button ${disabled ? 'disabled' : ''} ${hidden ? 'hidden' : ''}>Label</button>`,
				);

				assert.lightDom.equal(el, '<button disabled hidden>Label</button>');

				hidden = false;
				await el.updateTemplate(
					html`<button ${disabled ? 'disabled' : ''} ${hidden ? 'hidden' : ''}>Label</button>`,
				);

				assert.lightDom.equal(el, '<button disabled>Label</button>');

				const active = true;
				await el.updateTemplate(
					html`<button ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}>Label</button>`,
				);

				assert.lightDom.equal(el, '<button disabled active>Label</button>');
			});
		}

		it('can render bindings inside attributes', async () => {
			const el = await fixture(`<${templateTag}></${templateTag}>`);

			const active = true;
			await el.updateTemplate(html`<a class="link ${active ? 'is-active' : ''}">Label</a>`);

			assert.lightDom.equal(el, '<a class="link is-active">Label</a>');
		});

		it('can render multiple bindings inside attributes', async () => {
			const el = await fixture(`<${templateTag}></${templateTag}>`);

			const active = true;
			const highlight = true;
			await el.updateTemplate(
				html`<a class="link ${active ? 'is-active' : ''} ${highlight ? 'is-highlight' : ''}">Label</a>`,
			);

			assert.lightDom.equal(el, '<a class="link is-active is-highlight">Label</a>');
		});

		it('can render conditional nested html templates', async () => {
			const el = await fixture(`<${templateTag}></${templateTag}>`);

			const nested = true;
			await el.updateTemplate(html`<div>${nested ? html`<div class="nested">nested</div>` : html``}</div>`);

			assert.lightDom.equal(el, '<div><div class="nested">nested</div></div>');
		});

		it('can render empty conditional html templates', async () => {
			const el = await fixture(`<${templateTag}></${templateTag}>`);

			const nested = false;
			await el.updateTemplate(html`<div>${nested ? html`<div class="nested">nested</div>` : html``}</div>`);

			assert.lightDom.equal(el, '<div></div>');
		});

		it('can render lists with looped bindings', async () => {
			const el = await fixture(`<${templateTag}></${templateTag}>`);

			const colors = ['red', 'green', 'blue'];
			await el.updateTemplate(html`<ul>
				${colors.map((color) => html`<li>${color}</li>`)}
			</ul>`);

			assert.lightDom.equal(el, '<ul><li>red</li><li>green</li><li>blue</li></ul>');
		});
	});
};
