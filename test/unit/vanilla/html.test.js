/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { html, unsafeHTML } from '../../../src/renderer/vanilla';

describe('vanilla-html literal', () => {
	it('creates the correct string from the literal', async () => {
		const literal = html`<div>Vanilla renderer</div>`;
		assert.equal(literal.toString(), `<div>Vanilla renderer</div>`);
	});

	it('parses the variable as string from the literal', () => {
		const variable = 'Vanilla renderer';
		const literal = html`<div>${variable}</div>`;
		assert.equal(literal.toString(), `<div>Vanilla renderer</div>`);
	});

	it('correctly sanitizes html input', () => {
		const literal = html`${`<strong>Unsafe HTML</strong>`}`;
		assert.equal(literal.toString(), `$lt;strong$gt;Unsafe HTML$lt;/strong$gt;`);
	});

	it('allows unsafe html input with the "unsafeHTML" directive', () => {
		const literal = html`${unsafeHTML(`<strong>Unsafe HTML</strong>`)}`;
		assert.equal(literal.toString(), `<strong>Unsafe HTML</strong>`);
	});

	it('correctly parses arrays of literals', () => {
		const parts = [html`<span>First part</span>`, html`<span>Second part</span>`];

		const literal = html`${parts}`;
		assert.equal(literal.toString(), `<span>First part</span><span>Second part</span>`);
	});

	it('correctly parses an array of unsafe strings', () => {
		const parts = [`<strong>First part</strong>`, `<strong>Second part</strong>`];

		const literal = html`${parts}`;
		assert.equal(
			literal.toString(),
			`$lt;strong$gt;First part$lt;/strong$gt;$lt;strong$gt;Second part$lt;/strong$gt;`,
		);
	});

	it('allows unsafe html input with the "unsafeHTML" directive in arrays', () => {
		const parts = [unsafeHTML(`<strong>First part</strong>`), unsafeHTML(`<strong>Second part</strong>`)];

		const literal = html`${parts}`;
		assert.equal(
			literal.toString(),
			`<strong>First part</strong><strong>Second part</strong>`,
		);
	});
});
