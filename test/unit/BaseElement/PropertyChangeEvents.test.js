/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert, oneEvent } from '@open-wc/testing';
import { BaseElement } from '../../../src/BaseElement';

const tag = defineCE(
    class extends BaseElement {
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
                nameChanged: false,
                lastNameChanged: false,
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

describe('PropertyChangeEvents', () => {
    it('does not notify property changes by default', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        el.name = 'Jane';
        assert.isFalse(el.nameChanged);
    });

    it('maps the camel case property name to dash case and adds -changed as the event name', async () => {
        const el = await fixture(`<${tag}></${tag}>`);

        setTimeout(() => (el.lastName = 'Smith'));
        await oneEvent(el, 'last-name-changed');
    });

    it('notifies property changes when configured via constructor options', async () => {
        const el = await fixture(`<${tag}></${tag}>`);
        el.lastName = 'Smith';

        await oneEvent(el, 'last-name-changed');

        assert.isTrue(el.lastNameChanged);
    });

    it('sends the new property value via event.detail', async () => {
        const el = await fixture(`<${tag}></${tag}>`);

        setTimeout(() => (el.lastName = 'Smith'));
        const event = await oneEvent(el, 'last-name-changed');
        assert.equal(event.detail, 'Smith');
    });
});
