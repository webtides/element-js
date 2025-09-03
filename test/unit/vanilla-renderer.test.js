import { assert, defineCE, fixture, nextFrame, waitUntil } from '@open-wc/testing';
import { TemplateElement, html } from '../../src/TemplateElement.js';
import { stripCommentMarkers } from '../util/testing-helpers.js';

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

class NestedShadowTag extends TemplateElement {
    constructor() {
        super({ shadowRender: true });
    }

    template() {
        return html` <slot></slot>`;
    }
}

customElements.define('nested-shadow-tag', NestedShadowTag);

class NestedShadowDefaultTag extends NestedShadowTag {
    template() {
        return html` <slot>DEFAULT</slot>`;
    }
}

customElements.define('nested-shadow-default-tag', NestedShadowDefaultTag);

class SlottingParentTag extends TemplateElement {
    properties() {
        return {
            text: 'Foo',
        };
    }

    template() {
        return html`
            <nested-shadow-tag>
                <div>${this.text}</div>
            </nested-shadow-tag>
        `;
    }
}

customElements.define('slotting-parent-tag', SlottingParentTag);

class SlottingParentDefaultTag extends TemplateElement {
    template() {
        return html` <nested-shadow-default-tag></nested-shadow-default-tag> `;
    }
}

customElements.define('slotting-parent-default-tag', SlottingParentDefaultTag);

class SlottingParentNotDefaultTag extends TemplateElement {
    template() {
        return html` <nested-shadow-default-tag>NOT_DEFAULT</nested-shadow-default-tag> `;
    }
}

customElements.define('slotting-parent-not-default-tag', SlottingParentNotDefaultTag);

class NestedLightTag extends TemplateElement {
    template() {
        return html` <div>Foo</div>`;
    }
}

customElements.define('nested-light-tag', NestedLightTag);

class NestingParentTag extends TemplateElement {
    properties() {
        return {
            text: 'Bar',
        };
    }

    template() {
        return html` <nested-light-tag>
            <div>${this.text}</div>
        </nested-light-tag>`;
    }
}

customElements.define('nesting-parent-tag', NestingParentTag);

class ArrayRenderingTag extends TemplateElement {
    properties() {
        return {
            list: [1],
        };
    }

    template() {
        return html` <div>
            <ul ref="list" data-length="${this.list.length}">
                ${this.list.map((index) => html` <li>${index}</li>`)}
            </ul>
        </div>`;
    }
}

customElements.define('array-rendering-tag', ArrayRenderingTag);

class ConditionalArrayRenderingTag extends TemplateElement {
    properties() {
        return {
            list: [1],
            renderArray: true,
            flatList: false,
        };
    }

    template() {
        if (this.flatList) {
            return html`
                ${this.renderArray
                    ? this.list.map((index) => html`<div>${index}</div>`)
                    : html`<strong>no list</strong>`}
            `;
        }
        return html`<div>
            ${this.renderArray
                ? html`<ul ref="list" data-length="${this.list.length}">
                      ${this.list.map((index) => html` <li>${index}</li>`)}
                  </ul>`
                : html`<strong>no list</strong>`}
        </div>`;
    }
}

customElements.define('conditional-array-rendering-tag', ConditionalArrayRenderingTag);
class OnePropTag extends TemplateElement {
    properties() {
        return {
            prop: 'init',
        };
    }

    template() {
        return html`${this.prop}`;
    }
}
customElements.define('one-prop-tag', OnePropTag);

class NestedElementTag extends TemplateElement {
    properties() {
        return {
            label: 'initial',
        };
    }

    template() {
        return html`<button>${this.label}</button>`;
    }
}

customElements.define('nested-element-tag', NestedElementTag);

class ArrayRenderingNestedElementsTag extends TemplateElement {
    properties() {
        return {
            list: [1],
        };
    }

    template() {
        return html` <div>
            ${this.list.map((index) => html`<nested-element-tag label="${'label' + index}"></nested-element-tag>`)}
        </div>`;
    }
}

customElements.define('array-rendering-nested-elements-tag', ArrayRenderingNestedElementsTag);

describe(`template rendering`, () => {
    it('renders template in light dom by default', async () => {
        const el = await fixture(`<${lightTag}></${lightTag}>`);
        assert.isNull(el.shadowRoot);
        assert.lightDom.equal(el, '<div>light content</div>');
    });
    //
    it('can render template in shadow dom by setting shadowRender: true via constructor options', async () => {
        const el = await fixture(`<${shadowTag}></${shadowTag}>`);
        assert.isNotNull(el.shadowRoot);
        assert.shadowDom.equal(el, '<div>shadow content</div>');
    });
    //
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
describe(`vanilla-renderer`, () => {
    it('can re-render/update slotted templates', async () => {
        const el = await fixture(`<slotting-parent-tag></slotting-parent-tag>`);
        assert.lightDom.equal(el, `<nested-shadow-tag><div>Foo</div></nested-shadow-tag>`);
        el.text = 'Bar';
        await el.requestUpdate();
        assert.lightDom.equal(el, `<nested-shadow-tag><div>Bar</div></nested-shadow-tag>`);
    });

    it('should not re-render/update nested templates', async () => {
        const el = await fixture(`<nesting-parent-tag></nesting-parent-tag>`);
        assert.lightDom.equal(el, `<nested-light-tag><div>Bar</div></nested-light-tag>`);
        await el.requestUpdate();
        assert.lightDom.equal(el, `<nested-light-tag><div>Foo</div></nested-light-tag>`);
        el.text = 'Baz';
        await el.requestUpdate();
        assert.lightDom.equal(el, `<nested-light-tag><div>Foo</div></nested-light-tag>`);
    });

    it('should render default content in a slot', async () => {
        const defaultContent = '<slot>DEFAULT</slot>';
        const el = await fixture(`<nested-shadow-default-tag></nested-shadow-default-tag>`);
        await el.requestUpdate();
        assert.shadowDom.equal(el, defaultContent);
    });

    it('should be wider with default content than without', async () => {
        const el = await fixture(`<nested-shadow-tag></nested-shadow-tag>`);
        await el.requestUpdate();
        const defaultElement = await fixture(`<nested-shadow-default-tag></nested-shadow-default-tag>`);
        await defaultElement.requestUpdate();

        assert.isTrue(el.offsetWidth < defaultElement.offsetWidth);
    });
    it('should become wider with slotted content than with default', async () => {
        const defaultElement = await fixture(`<nested-shadow-default-tag></nested-shadow-default-tag>`);
        await defaultElement.requestUpdate();
        const otherElement = await fixture(`<nested-shadow-default-tag>NOT_DEFAULT</nested-shadow-default-tag>`);
        await otherElement.requestUpdate();

        assert.isTrue(defaultElement.offsetWidth < otherElement.offsetWidth);
    });

    it('should render default content even if rendered by another element', async () => {
        const defaultContent = '<slot>DEFAULT</slot>';
        const defaultElement = await fixture(`<nested-shadow-default-tag></nested-shadow-default-tag>`);
        await defaultElement.requestUpdate();

        const parentElement = await fixture(`<slotting-parent-default-tag></slotting-parent-default-tag>`);
        await parentElement.requestUpdate();
        const nested = parentElement.querySelector('nested-shadow-default-tag');
        await nested.requestUpdate();
        assert.equal(defaultElement.offsetWidth, nested.offsetWidth);
    });

    it('should render slotted content even if rendered by another element', async () => {
        const defaultElement = await fixture(`<nested-shadow-default-tag>NOT_DEFAULT</nested-shadow-default-tag>`);
        await defaultElement.requestUpdate();

        const parentElement = await fixture(`<slotting-parent-not-default-tag></slotting-parent-not-default-tag>`);
        await parentElement.requestUpdate();
        const nested = parentElement.querySelector('nested-shadow-default-tag');
        await nested.requestUpdate();
        assert.equal(defaultElement.offsetWidth, nested.offsetWidth);
    });

    it('renders changes to arrays properly', async () => {
        const arrayElement = await fixture(`<array-rendering-tag></array-rendering-tag>`);
        await nextFrame();
        assert.equal(
            stripCommentMarkers(arrayElement.innerHTML),
            '<div><ul ref="list" data-length="1"><li>1</li></ul></div>',
        );

        arrayElement.list = [1, 2];
        await nextFrame();

        assert.equal(
            stripCommentMarkers(arrayElement.innerHTML),
            '<div><ul ref="list" data-length="2"><li>1</li><li>2</li></ul></div>',
        );
        arrayElement.list = [1, 2, 3];
        await nextFrame();
        assert.equal(
            stripCommentMarkers(arrayElement.innerHTML),
            '<div><ul ref="list" data-length="3"><li>1</li><li>2</li><li>3</li></ul></div>',
        );

        arrayElement.list = [];
        await nextFrame();
        assert.equal(stripCommentMarkers(arrayElement.innerHTML), '<div><ul ref="list" data-length="0"></ul></div>');
    });

    it('renders in-place changes to arrays properly', async () => {
        const arrayElement = await fixture(`<array-rendering-tag></array-rendering-tag>`);
        await nextFrame();
        assert.equal(
            stripCommentMarkers(arrayElement.innerHTML),
            '<div><ul ref="list" data-length="1"><li>1</li></ul></div>',
        );

        arrayElement.list = [1, 2, 3];
        await nextFrame();
        assert.equal(
            stripCommentMarkers(arrayElement.innerHTML),
            '<div><ul ref="list" data-length="3"><li>1</li><li>2</li><li>3</li></ul></div>',
        );

        arrayElement.list = [1, 69, 3];
        await nextFrame();
        assert.equal(
            stripCommentMarkers(arrayElement.innerHTML),
            '<div><ul ref="list" data-length="3"><li>1</li><li>69</li><li>3</li></ul></div>',
        );
    });

    it('renders arrays and other content conditionally', async () => {
        const arrayElement = await fixture(`<conditional-array-rendering-tag></conditional-array-rendering-tag>`);
        await nextFrame();
        assert.equal(
            stripCommentMarkers(arrayElement.innerHTML),
            '<div><ul ref="list" data-length="1"><li>1</li></ul></div>',
        );
        arrayElement.renderArray = false;
        await nextFrame();

        assert.equal(stripCommentMarkers(arrayElement.innerHTML), '<div><strong>no list</strong></div>');

        // arrayElement.list = [1, 2, 3];
        arrayElement.renderArray = true;
        await nextFrame();
        assert.equal(
            stripCommentMarkers(arrayElement.innerHTML),
            '<div><ul ref="list" data-length="1"><li>1</li></ul></div>',
        );
    });

    it('renders a property even if the type changes between complex and primitive', async () => {
        const element = await fixture(`<one-prop-tag></one-prop-tag>`);
        await nextFrame();
        assert.equal(stripCommentMarkers(element.innerHTML), 'init');
        element.prop = 'bar';
        await nextFrame();
        assert.equal(stripCommentMarkers(element.innerHTML), 'bar');

        // TODO uncomment once serialization is commited
        // element.prop = [1, 2, 3];
        // await nextFrame();
        // assert.equal(stripCommentMarkers(element.innerHTML), '1,2,3');
    });

    it('renders a flat list of elements vs other content conditionally', async () => {
        const arrayElement = await fixture(
            `<conditional-array-rendering-tag flat-list="true"></conditional-array-rendering-tag>`,
        );
        await nextFrame();
        assert.equal(stripCommentMarkers(arrayElement.innerHTML), '<div>1</div>');
        arrayElement.renderArray = false;
        await nextFrame();

        assert.equal(stripCommentMarkers(arrayElement.innerHTML), '<strong>no list</strong>');
        arrayElement.list = [1, 2, 3];
        arrayElement.renderArray = true;
        await nextFrame();
        assert.equal(stripCommentMarkers(arrayElement.innerHTML), '<div>1</div><div>2</div><div>3</div>');
    });

    it('Renders a list of nested template elements', async () => {
        const arrayElement = await fixture(
            `<array-rendering-nested-elements-tag></array-rendering-nested-elements-tag>`,
        );
        await nextFrame();

        assert.equal(arrayElement.innerText, 'label1');
        arrayElement.list = [2, 3, 4];

        await nextFrame();
        await nextFrame();
        assert.equal(arrayElement.innerText, 'label2 label3 label4');
        arrayElement.list = [5];

        await nextFrame();
        await nextFrame();
        assert.equal(arrayElement.innerText, 'label5');
    });

    it.only('Renders attribute values even after being reconnected to the DOM', async () => {
        const el = await fixture(`<nested-element-tag label="test"></nested-element-tag>`);
        await nextFrame();

        assert.equal(el.innerText, 'test');
        el.label = 'test2';

        await nextFrame();
        assert.equal(el.innerText, 'test2');

        const parentNode = el.parentNode;
        parentNode.removeChild(el);
        await nextFrame();
        el.setAttribute('label', 'test3');
        // Reattach the element to its parent node
        await nextFrame();
        parentNode.appendChild(el);
        await nextFrame();

        assert.equal(
            stripCommentMarkers(el.outerHTML),
            '<nested-element-tag label="test3"><button>test3</button></nested-element-tag>',
        );
        assert.equal(el.innerText, 'test3');
    });
});
