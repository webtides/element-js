import { fixture, assert, nextFrame } from '@open-wc/testing';

export const stripCommentMarkers = (html) =>
	html
		.replace(/<!--(\/?)(template-part|dom-part-\d+(:\w+)?)-->/g, '')
		.replace(/\s+/g, ' ')
		.replaceAll('> ', '>')
		.trim();

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
			const el = await fixture(`<unsafe-tag></unsafe-tag>`);
			await el.updateContent();
			assert.equal(
				stripCommentMarkers(el.innerHTML.replace(/^\s+|\s+$|\s+(?=\s)/g, '')),
				`<div><strong>unsafe content</strong>1</div>`,
			);
		});

		it('correctly passes the sanitized html to child components', async () => {
			console.log('test', sanitizedParentTag);
			const el = await fixture(`<sanitized-parent-tag></sanitized-parent-tag>`);
			await nextFrame();
			assert.lightDom.equal(
				el,
				`
			<child-tag text="&lt;strong&gt;unsafe content&lt;/strong&gt;">
				&lt;strong&gt;unsafe content&lt;/strong&gt;
			</child-tag>
		`,
			);
		});
	});
};
