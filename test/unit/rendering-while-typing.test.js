/* eslint-disable no-unused-expressions */
import { fixture, defineCE, fixtureCleanup, assert, nextFrame } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { TemplateElement, html, unsafeHTML } from '../../src/renderer/vanilla/TemplateElement';

const lightTag = defineCE(
	class extends TemplateElement {
		template() {
			return html` <div>light content</div> `;
		}
	},
);

const shadowTag = defineCE(
	class extends TemplateElement {
		constructor() {
			super({ shadowRender: true });
		}

		template() {
			return html` <div>shadow content</div> `;
		}
	},
);

const deferTag = defineCE(
	class extends TemplateElement {
		constructor() {
			super({ deferUpdate: true });
		}

		template() {
			return html` <div>deferred content</div> `;
		}
	},
);

const noHtmlTag = defineCE(
	class extends TemplateElement {
		template() {
			return `<div>no html template result content</div>`;
		}
	},
);

const formTag = defineCE(
	class extends TemplateElement {
		constructor() {
			super({ deferUpdate: true });
		}

		properties() {
			return {
				value: '',
				simple: false,
			};
		}

		events() {
			return {
				'[ref="input"]': {
					input: () => {
						console.log('input');
						this.updateValueFromInput();
					},
					blur: () => {
						console.log('blur');
						this.updateValueFromInput();
					},
					change: () => {
						console.log('change');
						this.updateValueFromInput();
					},
				},
			};
		}

		updateValueFromInput() {
			this.value = this.$refs.input.value;
		}

		template() {
			const tpl = `
					<form data-value="${this.value}">
						<div ref="display">${this.value}</div>
						<input type="text" ref="input">
					</form>`;

			console.log('is simple', this.simple);
			return this.simple ? tpl : html`${unsafeHTML(tpl)}`;
		}
	},
);

describe('rendering-while-typing', () => {
	const doTest = async (el) => {
		await el.requestUpdate();
		await nextFrame();
		console.log(el);
		// set value like the user would
		el.$refs.input.focus();
		el.$refs.input.value = 'test1';
		// trigger change
		el.$refs.input.dispatchEvent(new Event('change'));
		console.log(document.activeElement);
		const keys = 'abc123';
		await sendKeys({
			type: '2',
		});
		assert.equal(el.$refs.input.value, 'test12');
		assert.equal(el.$refs.input.value, el.value);
		await sendKeys({
			type: '3',
		});
	};

	it('keeps input while typing and triggering updates along the way', async () => {
		const el = await fixture(`<${formTag}></${formTag}>`);
		await doTest(el);
		assert.equal(el.value, 'test123');
	});
	it('looses input while typing and triggering updates along the way when rendering a simple string literal', async () => {
		const el = await fixture(`<${formTag} simple="true"></${formTag}>`);
		await doTest(el);
		console.log(document.activeElement);

		//TODO .. bug does not appear in test
		assert.equal(document.activeElement, el.$refs.input);
		assert.equal(el.value, 'test123');
	});
});
