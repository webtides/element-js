/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { TemplateElement, html } from '../../src/TemplateElement';

const templateTag = defineCE(
	class extends TemplateElement {
		async updateTemplate(template) {
			this._template = template;
			await this.requestUpdate();
		}
	},
);

describe('templates', () => {
	it('can render simple dom without any bindings', async () => {
		const el = await fixture(`<${templateTag}></${templateTag}>`);

		await el.updateTemplate(html`<div class="parent"><div class="child">content</div></div>`);

		assert.lightDom.equal(el, '<div class="parent"><div class="child">content</div></div>');
	});

	it('can render simple bindings as node content', async () => {
		const el = await fixture(`<${templateTag}></${templateTag}>`);

		let name = 'John';
		await el.updateTemplate(html`<div>Hello ${name}</div>`);

		assert.lightDom.equal(el, '<div>Hello John</div>');
	});

	it('can have functions as bindings', async () => {
		const el = await fixture(`<${templateTag}></${templateTag}>`);

		const name = () => 'John';
		await el.updateTemplate(html`<div>Hello ${name()}</div>`);

		assert.lightDom.equal(el, '<div>Hello John</div>');
	});

	it('can render bindings with html templates', async () => {
		const el = await fixture(`<${templateTag}></${templateTag}>`);

		let nested = html`<div class="nested"></div>`;
		await el.updateTemplate(html`<div>${nested}</div>`);

		assert.lightDom.equal(el, '<div><div class="nested"></div></div>');
	});

	it('can render list bindings', async () => {
		const el = await fixture(`<${templateTag}></${templateTag}>`);

		let list = [html`<div>1</div>`, html`<div>2</div>`, html`<div>3</div>`];
		await el.updateTemplate(html`<div>${list}</div>`);

		assert.lightDom.equal(el, '<div><div>1</div><div>2</div><div>3</div></div>');
	});

	// TODO: this should actually work for lit-html but it crashes...
	// it('can render bindings as node attributes', async () => {
	// 	const el = await fixture(`<${templateTag}></${templateTag}>`);
	//
	// 	const disabled = true;
	// 	await el.updateTemplate(html`<button ${disabled ? 'disabled' : ''}>Label</button>`);
	//
	// 	assert.lightDom.equal(el, '<button disabled>Label</button>');
	// });

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
