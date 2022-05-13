import { fixture, assert } from '@open-wc/testing';

export const testTemplateRendering = function (name, lightTag, shadowTag, deferTag, noHtmlTag) {
	describe(`template rendering for ${name}`, () => {
		it('renders template in light dom by default', async () => {
			const el = await fixture(`<${lightTag}></${lightTag}>`);
			assert.isNull(el.shadowRoot);
			assert.lightDom.equal(el, '<div>light content</div>');
		});

		it('can render template in shadow dom by setting shadowRender: true via constructor options', async () => {
			const el = await fixture(`<${shadowTag}></${shadowTag}>`);
			assert.isNotNull(el.shadowRoot);
			assert.shadowDom.equal(el, '<div>shadow content</div>');
		});

		it('can defer rendering template by setting deferUpdate: true via constructor options', async () => {
			const el = await fixture(`<${deferTag}></${deferTag}>`);
			assert.equal(el.innerHTML.trim(), '');
			assert.lightDom.equal(el, '');
			await el.requestUpdate();
			assert.lightDom.equal(el, '<div>deferred content</div>');
		});

		it('can render standard strings as template instead of html template results', async () => {
			const el = await fixture(`<${noHtmlTag}></${noHtmlTag}>`);
			assert.lightDom.equal(el, '<div>no html template result content</div>');
		});
	});
};
