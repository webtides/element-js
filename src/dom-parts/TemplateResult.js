import { TemplatePart } from './TemplatePart.js';
import { findTemplateStart } from './markers.js';
import { ParseTemplateError } from './parseTemplate.js';
import { stringify } from './stringify.js';

/** @type {WeakMap<Element | ShadowRoot, TemplatePart>} the rendered instance of a node */
const templatePartsCache = new WeakMap();

/**
 * A template literal with its values, what html`` returns. Renders into the DOM through renderInto(), writes
 * markup through toString().
 */
export class TemplateResult {
    /**
     * @param {TemplateStringsArray} strings
     * @param {any[]} values
     */
    constructor(strings, ...values) {
        this.strings = strings;
        this.values = values;
    }

    /**
     * Renders into a DOM node. A node that holds a rendered instance of this literal is updated, a node with server
     * rendered markup, a template start marker, is hydrated, anything else is replaced by a fresh render.
     * @param {Element | ShadowRoot} domNode
     */
    renderInto(domNode) {
        let templatePart = templatePartsCache.get(domNode);
        // the instance of the same literal is updated while its markers are in the node, innerHTML or render() with
        // a string may have removed them. Another literal renders fresh
        if (templatePart?.strings === this.strings && templatePart.startNode.parentNode === domNode) {
            templatePart.update(this);
            return;
        }

        // server rendered markup is hydrated by the first render into the node
        const startNode = templatePart ? undefined : findTemplateStart(domNode.firstChild);
        templatePart = new TemplatePart(this, startNode);
        templatePart.update(this);
        if (!templatePart.hydrated) {
            domNode.replaceChildren();
            templatePart.insertBefore(domNode, null);
        }
        templatePartsCache.set(domNode, templatePart);
    }

    /**
     * @return {string} the markup for this template and its values, with the markers the client hydrates by
     */
    toString() {
        return stringify(this);
    }
}

export { ParseTemplateError };
