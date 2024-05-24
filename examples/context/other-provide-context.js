import { TemplateElement, defineElement, html } from '../../src/renderer/vanilla';

class OtherProvideContext extends TemplateElement {
    // reactive attributes/properties
    constructor() {
        super({ shadowRender: true });
    }
    properties() {
        return {
            otherContext: 'i am a callback context',
        };
    }
    provideProperties() {
        return {
            otherContext: this.otherContext,
        };
    }
    template() {
        return html`
            <div>Other Provider: ${this.otherContext}</div>
            <slot></slot>
        `;
    }
}
defineElement('other-provide-context', OtherProvideContext);
