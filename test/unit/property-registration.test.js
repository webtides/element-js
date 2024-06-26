/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { BaseElement } from '../../src/BaseElement';

const tagA = defineCE(
    class extends BaseElement {
        connected() {
            this.$refs.nestedElement.name = 'NestedElement';
        }
    },
);

const tagB = defineCE(
    class extends BaseElement {
        properties() {
            return {
                name: 'oldName',
                conflict: 'conflictingValue',
            };
        }

        connected() {
            super.connected();
            this.conflict = 999;
            // this.conflict();
        }

        conflict() {
            console.log('i am important');
        }
    },
);

describe('property-registration', () => {
    it('applies property values that are set before the browser registers the custom element', async () => {
        const el = await fixture(`<${tagA}>
            <${tagB} ref="nestedElement"></${tagB}>
        </${tagA}>`);
        assert.equal(el.$refs.nestedElement.name, 'NestedElement');
    });

    it('prefers attribute values over property values when both are defined', async () => {
        const el = await fixture(`<${tagB} name="newName"></${tagB}>`);
        assert.notEqual(el.name, 'oldName');
        assert.equal(el.name, 'newName');
    });

    it('will not register a property when the name is already taken', async () => {
        const el = await fixture(`<${tagB} ></${tagB}>`);
        assert.equal(el.name, 'oldName');
        console.log(el, el.conflict);
        el.conflict = 777;
        console.log(el, el.conflict);
        console.log('methof', el.conflict());
    });
});
