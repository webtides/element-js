/* eslint-disable no-unused-expressions */

import { fixtureSync, defineCE, assert, expect, nextFrame } from '@open-wc/testing';
import { TemplateElement, html } from '../../src/TemplateElement';

const color2 = 'rgb(255, 0, 255)';
const shadowTag = defineCE(
    class extends TemplateElement {
        constructor() {
            super({ shadowRender: true });
        }

        styles() {
            return [`span {color: ${color2} }`];
        }

        template() {
            return html`<span ref="coloredSpan"></span>`;
        }
    },
);

const lightTag = defineCE(
    class extends TemplateElement {
        styles() {
            return [`span {color: ${color2} }`];
        }
        template() {
            return html`<span ref="coloredSpan"></span>`;
        }
    },
);

describe('append-styles-no-global-styles', () => {
    let cssReplace;

    before(() => {
        //convert chrome to firefox
        cssReplace = CSSStyleSheet.prototype.replace;
        delete CSSStyleSheet.prototype.replace;
    });

    it('appends stylesheets if the browser does not support adopting Styleheets (shadow-dom)', async () => {
        const el = fixtureSync(`<${shadowTag}></${shadowTag}>`);
        await nextFrame();
        const computeSpanColor = await window.getComputedStyle(el.$refs.coloredSpan).getPropertyValue('color');
        assert.equal(computeSpanColor, color2);
    });

    it('appends stylesheets if the browser does not support adopting Styleheets (light-dom)', async () => {
        const el = fixtureSync(`<${lightTag}></${lightTag}>`);
        await nextFrame();
        const computeSpanColor = await window.getComputedStyle(el.$refs.coloredSpan).getPropertyValue('color');

        assert.equal(computeSpanColor, color2);
    });

    after(() => {
        CSSStyleSheet.prototype.replace = cssReplace;
    });
});
