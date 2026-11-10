import { TemplateElement, defineElement, html, Store } from '../../index.js';

class ShadowElement extends TemplateElement {
    constructor() {
        super({ shadowRender: true });
    }

    properties() {
        // the page sets source="server side" on the element with the declarative shadow root
        return { source: 'client side' };
    }

    template() {
        return html` <div>${this.source} shadow root content</div> `;
    }
}

defineElement('shadow-element', ShadowElement);
