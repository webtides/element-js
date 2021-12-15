/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, oneEvent, nextFrame } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';

const tag = defineCE(
	class extends BaseElement {
		nameChanged = false;
		lastNameChanged = false;

		constructor() {
			super({
				propertyOptions: {
					lastName: { notify: true },
				},
			});
		}

		properties() {
			return {
				name: 'John',
				lastName: 'Doe',
			};
		}

		events() {
			return {
				this: {
					'name-changed': () => {
						this.nameChanged = true;
					},
					'last-name-changed': () => {
						this.lastNameChanged = true;
					},
				},
			};
		}
	},
);

describe('property-change-events', () => {
	it('does not notify property changes by default', async () => {
		const el = await fixture(`<${tag}></${tag}>`);
		el.name = 'Jane';
		await nextFrame();
		assert.isFalse(el.nameChanged);
	});

	it('notifies property changes when configured via constructor options', async () => {
		const el = await fixture(`<${tag}></${tag}>`);
		el.lastName = 'Smith';
		await nextFrame();
		assert.isTrue(el.lastNameChanged);
	});

	it('maps the camel case property name to dash case and adds -changed as the event name', async () => {
		const el = await fixture(`<${tag}></${tag}>`);
		setTimeout(() => (el.lastName = 'Smith'));
		await oneEvent(el, 'last-name-changed');
	});

	it('sends the new property value via event.detail', async () => {
		const el = await fixture(`<${tag}></${tag}>`);

		setTimeout(() => (el.lastName = 'Smith'));
		const event = await oneEvent(el, 'last-name-changed');
		assert.equal(event.detail, 'Smith');
	});
});
