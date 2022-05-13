import { fixture, assert, nextFrame } from '@open-wc/testing';

export const testUnsafeHtml = function (name, sanitizedTag, unsafeTag, childTag, sanitizedParentTag) {
	describe(`unsafeHtml directive for ${name}`, () => {
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
		`,
			);
		});
	});
};
