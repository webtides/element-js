import { COMMENT_NODE, TEXT_NODE } from '../util/DOMHelper.js';
import { Part } from './Part.js';
import { TemplateResult } from './TemplateResult.js';
import { TemplatePart } from './TemplatePart.js';
import { PartMarkers } from './PartMarkers.js';

/**
 * Removes every node between the two markers, walking forward from the start marker. The markers are siblings,
 * nested markers in between go with their nodes. Not a Range: the browser keeps every Range alive and updates it on
 * each DOM mutation, one per part makes every later insertion pay for all of them.
 * @param {Comment} startNode
 * @param {Comment} endNode
 */
export const removeNodesBetweenComments = (startNode, endNode) => {
    const parentNode = endNode.parentNode;
    let node = startNode.nextSibling;
    while (node !== endNode) {
        const next = node.nextSibling;
        parentNode.removeChild(node);
        node = next;
    }
};

/**
 * @param {Comment} startNode
 * @param {Comment} endNode
 * @param {Node[]} nodes
 */
export const replaceNodesBetweenComments = (startNode, endNode, nodes) => {
    removeNodesBetweenComments(startNode, endNode);
    const parentNode = endNode.parentNode;
    for (const node of nodes) {
        parentNode.insertBefore(node, endNode);
    }
};

/**
 * @param {Comment} startNode
 * @param {Comment} endNode
 * @return {Node[]} the nodes between the markers, the markers themselves not included
 */
export const getNodesBetweenComments = (startNode, endNode) => {
    const nodes = [];
    for (let node = startNode.nextSibling; node !== endNode; node = node.nextSibling) {
        nodes.push(node);
    }
    return nodes;
};

/**
 * A node that is not in the DOM yet takes over an equal node that is in place: a fresh text node leaves the text node
 * that is there alone. The nodes of a template clone still sit in their fragment and never take over, they replace
 * what the server rendered in their place.
 * @param {Node} node
 * @param {Node} newChildNode
 * @return {boolean}
 */
const takesOver = (node, newChildNode) => !newChildNode.parentNode && node.isEqualNode(newChildNode);

/**
 * Brings the nodes between the markers in line with newChildNodes, in that order. Walks the live DOM with a cursor:
 * a node that is at the cursor already stays, stale nodes at the cursor are removed, anything else is inserted in
 * front of the cursor, which moves a node that is in the DOM further back, for example a hydrated template behind a
 * server rendered text. Nodes that are in place are never touched, so focus and element lifecycles survive.
 * @param {Node[]} newChildNodes
 * @param {Comment} startNode - the start marker
 * @param {Comment} endNode - the end marker
 */
const diffChildNodes = (newChildNodes, startNode, endNode) => {
    const parentNode = endNode.parentNode;
    // the set of new nodes tells a stale node from one that is needed further on. It is only built when the nodes
    // deviate from what is there, a list whose nodes are all in place never pays for it
    let keep;
    let current = startNode.nextSibling;
    for (let index = 0; index < newChildNodes.length; index++) {
        const newChildNode = newChildNodes[index];
        if (!newChildNode?.nodeType) {
            throw new Error('ChildNodePart: newChildNode is not a node');
        }
        if (current !== newChildNode && current !== endNode) {
            keep ??= new Set(newChildNodes);
            while (current !== endNode && !keep.has(current) && !takesOver(current, newChildNode)) {
                const next = current.nextSibling;
                parentNode.removeChild(current);
                current = next;
            }
        }
        if (current === newChildNode || (current !== endNode && !keep.has(current))) {
            // in place already, or a stale node the new one takes over
            current = current.nextSibling;
        } else {
            parentNode.insertBefore(newChildNode, current);
        }
    }
    while (current !== endNode) {
        const next = current.nextSibling;
        parentNode.removeChild(current);
        current = next;
    }
};

/**
 * An interpolation between elements: a text, a node, a template, an array of those, or nothing. The value is
 * rendered between the start and the end marker of the part.
 */
export class ChildNodePart extends Part {
    /** @type {PartMarkers} */
    markers;

    /** @type {import('./parseTemplate.js').NodeDescriptor} */
    descriptor;

    /**
     * True until the first update of a part that is bound to server rendered DOM: nested templates bind to the
     * server rendered markers between the part's markers and nodes that are in place already stay untouched.
     * @type {boolean}
     */
    hydrating;

    /** @type {TemplatePart|undefined} the instance of a template value */
    templatePart;

    /** @type {Array<TemplatePart|undefined>} indexed like the items of an array value, only template items have a part */
    arrayParts = [];

    /** @type {string|undefined} the HTML of the unsafeHTML() value that is rendered, if the value is one */
    unsafeHTML = undefined;

    /** @type {'empty' | 'text' | 'template' | 'node' | 'nodes'} what is rendered between the markers */
    renderedKind = 'empty';

    /** @type {any} the text, template part, node or node list that is rendered */
    rendered = undefined;

    /** @type {Text|undefined} string values are rendered into one text node that is reused across updates */
    textNode;

    /**
     * @param {Comment} startNode - the start marker
     * @param {import('./parseTemplate.js').NodeDescriptor} descriptor
     * @param {boolean} [hydrate] - the start marker is server rendered DOM
     */
    constructor(startNode, descriptor, hydrate = false) {
        if (!startNode || startNode.nodeType !== COMMENT_NODE) {
            throw new Error(
                startNode ? 'ChildNodePart: startNode is not a comment node' : 'ChildNodePart: startNode is undefined',
            );
        }

        super();

        startNode.__part = this; // add Part to comment node for debugging in the browser
        this.descriptor = descriptor;
        this.hydrating = hydrate;
        this.markers = PartMarkers.createFromStartNode(startNode);
    }

    /**
     * @param {any[]} values
     */
    update(values) {
        this.setValue(values[this.descriptor.index]);
    }

    /**
     * @param {TemplateResult | any[] | Node | any} value
     */
    setValue(value) {
        // unsafeHTML() marks its function with the HTML string. The same string again has nothing to do, the nodes
        // of the last parse are in place and are not parsed again
        const unsafeHTML = value?.__unsafeHTML ? value.string : undefined;
        if (unsafeHTML !== undefined && unsafeHTML === this.unsafeHTML) return;
        this.unsafeHTML = unsafeHTML;

        const hydrate = this.hydrating;
        this.hydrating = false;

        let resolved = value;
        while (typeof resolved === 'function') resolved = resolved();

        if (resolved instanceof TemplateResult) {
            this.commit('template', this.updateTemplate(resolved, hydrate), hydrate);
        } else if (Array.isArray(resolved)) {
            const nodes = this.updateArray(resolved, hydrate);
            this.commit(nodes.length === 0 ? 'empty' : 'nodes', nodes, hydrate);
        } else if (resolved?.nodeType) {
            this.commit('node', resolved, hydrate);
        } else if (resolved == null) {
            this.commit('empty', undefined, hydrate);
        } else {
            this.commit('text', String(resolved), hydrate);
        }
    }

    /**
     * The template part of a template value, updated. A template with another literal gets a new part, its nodes
     * replace the old ones in commit(). When hydrating, the part binds to the server rendered template between the
     * markers.
     * @param {TemplateResult} templateResult
     * @param {boolean} hydrate
     * @return {TemplatePart}
     */
    updateTemplate(templateResult, hydrate) {
        let templatePart = this.templatePart;
        if (!templatePart) {
            templatePart = new TemplatePart(hydrate ? this.markers.findNestedStartNode() : undefined, templateResult);
        } else if (templatePart.strings !== templateResult.strings) {
            templatePart = new TemplatePart(undefined, templateResult);
        }
        this.templatePart = templatePart;
        templatePart.update(templateResult);
        return templatePart;
    }

    /**
     * The nodes of an array value, in one pass: functions are resolved, nested arrays flattened, null and undefined
     * items dropped, which is the list the server renders. Template items get a part per position, updated here, a
     * different literal at a position gets a new part. Primitives become text nodes, nodes pass through. When
     * hydrating, the template parts bind to the server rendered templates between the markers, in order.
     * @param {any[]} items
     * @param {boolean} hydrate
     * @return {Node[]}
     */
    updateArray(items, hydrate) {
        const nodes = [];
        const parts = this.arrayParts;
        const nestedStartNodes = hydrate ? this.markers.findNestedStartNodes() : undefined;
        let position = 0;
        let nested = 0;
        const visit = (item) => {
            let value = item;
            while (typeof value === 'function') value = value();
            if (Array.isArray(value)) {
                for (const inner of value) visit(inner);
                return;
            }
            if (value == null) return;
            if (value instanceof TemplateResult) {
                let part = parts[position];
                if (!part || part.strings !== value.strings) {
                    part = new TemplatePart(nestedStartNodes?.[nested], value);
                    parts[position] = part;
                }
                nested++;
                part.update(value);
                for (const node of part.childNodes) nodes.push(node);
            } else {
                parts[position] = undefined;
                nodes.push(value?.nodeType ? value : document.createTextNode(value));
            }
            position++;
        };
        for (const item of items) visit(item);
        // the parts of items beyond the new length are released, their nodes go away with the diff
        parts.length = position;
        return nodes;
    }

    /**
     * Writes what was rendered for the value between the markers.
     * @param {'empty' | 'text' | 'template' | 'node' | 'nodes'} kind
     * @param {any} payload - the text, the template part, the node or the node list
     * @param {boolean} hydrate - server rendered nodes that fit stay in place
     */
    commit(kind, payload, hydrate) {
        if (kind === this.renderedKind && payload === this.rendered) return;
        const { startNode, endNode } = this.markers;

        if (kind === 'empty') {
            removeNodesBetweenComments(startNode, endNode);
        } else if (kind === 'text') {
            if (this.renderedKind !== 'text') {
                const serverTextNode = startNode.nextSibling;
                if (hydrate && serverTextNode.nodeType === TEXT_NODE && serverTextNode.nextSibling === endNode) {
                    // the server rendered text node is taken over as the text node of the part
                    this.textNode = serverTextNode;
                } else {
                    this.textNode ??= document.createTextNode('');
                    replaceNodesBetweenComments(startNode, endNode, [this.textNode]);
                }
            }
            if (this.textNode.data !== payload) this.textNode.data = payload;
        } else if (kind === 'template') {
            // a template part bound to server rendered DOM is in place already and is left alone
            if (payload.childNodes[0].parentNode !== endNode.parentNode) {
                replaceNodesBetweenComments(startNode, endNode, payload.childNodes);
            }
        } else {
            const nodes = kind === 'node' ? [payload] : payload;
            // a change of kind replaces what is there. Server rendered nodes go through the diff instead, nodes that
            // are in place already, for example a focused input, stay untouched
            if (this.renderedKind !== kind && !hydrate) {
                replaceNodesBetweenComments(startNode, endNode, nodes);
            } else {
                diffChildNodes(nodes, startNode, endNode);
            }
        }

        this.renderedKind = kind;
        this.rendered = payload;
    }
}
