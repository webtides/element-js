/**
 * Wrapper for defining custom elements so that registering an element multiple times won't crash
 * @param {string} name - name for the element tag
 * @param {CustomElementConstructor} constructor for the custom element
 */
export function defineElement(name, constructor) {
    try {
        customElements.define(name, constructor);
    } catch (e) {
        // console.log('error defining custom element', e);
    }
}
