import { COMMENT_NODE } from '../util/DOMHelper.js';
import { TemplatePart } from './TemplatePart.js';
import { isTemplateStart } from './markers.js';
import { ParseTemplateError } from './parseTemplate.js';
import { stringify } from './stringify.js';

/** @type {WeakMap<Element | ShadowRoot, TemplatePart>} the rendered instance of a node */
const templatePartsCache = new WeakMap();

/**
 * @param {Node[] | NodeList} childNodes
 * @return {Comment|undefined} the first template start marker among the nodes
 */
const findTemplateStartNode = (childNodes) => {
    for (const node of childNodes) {
        if (node.nodeType === COMMENT_NODE && isTemplateStart(node.data)) return node;
    }
    return undefined;
};

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
     * Renders into a DOM node. A node that already holds a rendered instance of this template is updated, a node with
     * server rendered markup (a template start marker) is hydrated, anything else is replaced by a fresh render.
     * @param {Element | ShadowRoot} domNode
     */
    renderInto(domNode) {
        let templatePart = templatePartsCache.get(domNode);
        // the cached instance is valid while its markers are in the node, innerHTML or render() with a string may
        // have removed them
        if (templatePart && templatePart.markers.startNode.parentNode === domNode) {
            templatePart.update(this);
            return;
        }

        const startNode = findTemplateStartNode(domNode.childNodes);
        templatePart = new TemplatePart(startNode, this);
        templatePartsCache.set(domNode, templatePart);

        templatePart.update(this);
        if (!templatePart.hydrated) {
            domNode.replaceChildren(...templatePart.childNodes);
        }
    }

    /**
     * @return {string} the markup for this template and its values, with the markers the client hydrates by
     */
    toString() {
        return stringify(this);
    }
}

export { ParseTemplateError };
