/* eslint-disable no-unused-expressions */
import { fixture, defineCE, assert } from '@open-wc/testing';
import { BaseElement } from '../../../src/BaseElement';

const tag = defineCE(class extends BaseElement {});

describe('AttributeReflection', () => {
    it('reflects string attributes correctly back as attributes from properties when changed', async () => {
        const el = await fixture(`<${tag} string-value='Hello'></${tag}>`);
        el.stringValue = 'Holla';
        assert.equal(el.getAttribute('string-value'), 'Holla');
    });

    it('reflects number attributes correctly back as attributes from properties when changed', async () => {
        const el = await fixture(`<${tag} number-value='0'></${tag}>`);
        el.numberValue = 13;
        assert.equal(el.getAttribute('number-value'), '13');
    });

    it('reflects boolean attributes correctly back as attributes from properties when changed', async () => {
        const el = await fixture(`<${tag} boolean-value='true'></${tag}>`);
        el.booleanValue = false;
        assert.equal(el.getAttribute('boolean-value'), 'false');
    });

    it('reflects object attributes correctly back as attributes from properties when changed', async () => {
        const el = await fixture(`<${tag} object-value='{"foo":"bar"}'></${tag}>`);
        el.objectValue = { bar: 'foo' };
        assert.equal(el.getAttribute('object-value'), '{"bar":"foo"}');
    });

    it('reflects array attributes correctly back as attributes from properties when changed', async () => {
        const el = await fixture(`<${tag} array-value='["one","two",3]'></${tag}>`);
        el.arrayValue = [1, 2, 3, 5, 8, 13, 20];
        assert.equal(el.getAttribute('array-value'), '[1,2,3,5,8,13,20]');
    });

    it('reflects undefined properties back as empty "" attributes when changed', async () => {
        const el = await fixture(`<${tag} undefined-value='Hello'></${tag}>`);
        el.undefinedValue = undefined;
        assert.notEqual(el.getAttribute('undefined-value'), 'undefined');
        assert.equal(el.getAttribute('undefined-value'), '');
    });

    it('reflects null properties back as empty "" attributes when changed', async () => {
        const el = await fixture(`<${tag} null-value='Hello'></${tag}>`);
        el.nullValue = null;
        assert.notEqual(el.getAttribute('null-value'), 'null');
        assert.equal(el.getAttribute('null-value'), '');
    });

    it('reflects NaN properties back as empty "" attributes when changed', async () => {
        const el = await fixture(`<${tag} nan-value='Hello'></${tag}>`);
        el.nanValue = NaN;
        assert.notEqual(el.getAttribute('nan-value'), 'NaN');
        assert.equal(el.getAttribute('nan-value'), '');
    });
});
