/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, nextFrame } from '@open-wc/testing';
import { TemplateElement, html, unsafeHTML } from '../../../src/renderer/vanilla';

const sanitizedTag = defineCE(
	class extends TemplateElement {
		template() {
			return html` <div>${'<strong>unsafe content</strong>'}</div> `;
		}
	},
);

const unsafeTag = defineCE(
	class extends TemplateElement {
		properties() {
			return {
				count: 0,
			};
		}

		updateContent() {
			this.count += 1;
		}

		template() {
			return html` <div>${unsafeHTML(`<strong>unsafe content</strong>${this.count}`)}</div> `;
		}
	},
);

const childTag = defineCE(
	class extends TemplateElement {
		properties() {
			return {
				text: '',
			};
		}

		template() {
			return html`${this.text}`;
		}
	},
);

const sanitizedParentTag = defineCE(
	class extends TemplateElement {
		template() {
			return html`<${childTag} text="${'<strong>unsafe content</strong>'}"></${childTag}>`;
		}
	},
);

describe('unsafe template-rendering', () => {
	it('sanitizes the unsafe html input', async () => {
		const el = await fixture(`<${sanitizedTag}></${unsafeTag}>`);
		assert.lightDom.equal(el, '<div>$lt;strong$gt;unsafe content$lt;/strong$gt;</div>');
	});

	it('renders the unsafe html input', async () => {
		const el = await fixture(`<${unsafeTag}></${unsafeTag}>`);
		assert.lightDom.equal(el, '<div><strong>unsafe content</strong>0</div>');
	});

	it('correctly updates unsafe input', async () => {
		const el = await fixture(`<${unsafeTag}></${unsafeTag}>`);
		el.updateContent();
		await nextFrame();
		assert.lightDom.equal(el, '<div><strong>unsafe content</strong>1</div>');
	});

	it('correctly passes the sanitized html to child components', async () => {
		const el = await fixture(`<${sanitizedParentTag}></${sanitizedParentTag}>`);
		await nextFrame();
		assert.lightDom.equal(
			el,
			`
			<${childTag} text="$lt;strong$gt;unsafe content$lt;/strong$gt;">
				$lt;strong$gt;unsafe content$lt;/strong$gt;
			</${childTag}>
		`);
	});
});
