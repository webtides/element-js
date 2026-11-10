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

function getType(value) {
    if (value instanceof TemplatePart) return 'templatePart';
    if (value === null || value === undefined) return 'empty';
    if (Array.isArray(value)) return value.length === 0 ? 'empty' : 'array';
    if (value?.nodeType) return 'node';
    return 'text';
}

// the parsed items of an array as the child nodes to diff: template parts contribute their nodes, primitives become
// text nodes, DOM nodes pass through
const unwrapArray = (nodes) => {
    return nodes.flatMap((value) => {
        if (value instanceof TemplatePart) {
            return value.childNodes;
        }
        if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
            return document.createTextNode(value);
        }
        return value;
    });
};

/**
 * Array items get the same treatment as a single value: functions are resolved completely, arrays nested in the array
 * are flattened and null or undefined items are dropped, which is the list the server renders. An array that needs
 * none of it is returned as is.
 * @param {any[]} values
 * @return {any[]}
 */
const resolveArrayItems = (values) => {
    if (!values.some((value) => typeof value === 'function' || Array.isArray(value) || value == null)) {
        return values;
    }
    return values.flatMap((item) => {
        let value = item;
        while (typeof value === 'function') value = value();
        if (Array.isArray(value)) return resolveArrayItems(value);
        return value == null ? [] : [value];
    });
};

/**
 * Creates the processor that writes a parsed value between the markers of a child node part.
 * @param {PartMarkers} markers - the start and end marker of the part
 * @return {(function(TemplatePart | any[] | any, boolean=): void)}
 */
export const processNodePart = ({ startNode, endNode }) => {
    let oldValueType = 'empty';
    let oldValue = undefined;
    // string values are rendered into one text node that is reused across updates. It is created when the first
    // string arrives, hydration takes over the server rendered text node as that node
    let cachedTextNode;

    return (newValue, hydrate = false) => {
        const newValueType = getType(newValue);

        if (oldValueType === newValueType && oldValue === newValue) return;

        if (newValueType === 'empty') {
            removeNodesBetweenComments(startNode, endNode);
        } else if (newValueType === 'text') {
            if (oldValueType !== 'text') {
                const serverTextNode = startNode.nextSibling;
                if (hydrate && serverTextNode.nodeType === TEXT_NODE && serverTextNode.nextSibling === endNode) {
                    cachedTextNode = serverTextNode;
                } else {
                    cachedTextNode ??= document.createTextNode('');
                    replaceNodesBetweenComments(startNode, endNode, [cachedTextNode]);
                }
            }
            if (cachedTextNode.data !== String(newValue)) cachedTextNode.data = newValue;
        } else if (newValueType === 'templatePart') {
            // a template part bound to server rendered DOM (hydration) is in place already and is left alone
            if (newValue.childNodes[0].parentNode !== endNode.parentNode) {
                replaceNodesBetweenComments(startNode, endNode, newValue.childNodes);
            }
        } else {
            const nodes = newValueType === 'array' ? unwrapArray(newValue) : [newValue];
            // a type change replaces what is there. Server rendered nodes (hydration) go through the diff instead,
            // nodes that are in place already, for example a focused input, stay untouched
            if (oldValueType !== newValueType && !hydrate) {
                replaceNodesBetweenComments(startNode, endNode, nodes);
            } else {
                diffChildNodes(nodes, startNode, endNode);
            }
        }

        oldValueType = newValueType;
        oldValue = newValue;
    };
};

/**
 * For updating a text node, a sequence of child nodes or an array of `any` values
 */
export class ChildNodePart extends Part {
    /** @type {PartMarkers|undefined} */
    markers;

    /** @type {TemplatePart|undefined} */
    templatePart;

    /** @type {TemplatePart[]} indexed like the items of an array value, only template items have a part */
    arrayParts = [];

    /** @type {string|undefined} the HTML of the unsafeHTML() value that is rendered, if the value is one */
    unsafeHTML = undefined;

    /**
     * @param {Node} startNode - the start comment marker node
     */
    constructor(startNode) {
        if (!startNode || startNode?.nodeType !== COMMENT_NODE) {
            throw new Error(
                startNode ? 'ChildNodePart: startNode is not a comment node' : 'ChildNodePart: startNode is undefined',
            );
        }

        super();

        startNode.__part = this; // add Part to comment node for debugging in the browser
        this.markers = PartMarkers.createFromStartNode(startNode);
        this.processor = processNodePart(this.markers);
    }

    /**
     * @param {TemplateResult | any[] | any} value
     * @param {boolean} [hydrate] - bind nested template parts to the server rendered markers instead of cloning
     */
    update(value, hydrate = false) {
        // unsafeHTML() marks its function with the HTML string. The same string again has nothing to do, the nodes
        // of the last parse are in place and are not parsed again
        const unsafeHTML = value?.__unsafeHTML ? value.string : undefined;
        if (unsafeHTML !== undefined && unsafeHTML === this.unsafeHTML) return;
        this.unsafeHTML = unsafeHTML;
        // functions are resolved completely and array items are normalized, parsing and updating have to work on the
        // same value
        let resolvedValue = value;
        while (typeof resolvedValue === 'function') resolvedValue = resolvedValue();
        if (Array.isArray(resolvedValue)) resolvedValue = resolveArrayItems(resolvedValue);
        const parsedValue = this.parseValue(resolvedValue, hydrate);
        this.updateParts(resolvedValue, hydrate);
        this.processor(parsedValue, hydrate);
    }

    /**
     * @param {TemplateResult | any[] | any} value
     * @param {boolean} [hydrate]
     */
    updateParts(value, hydrate = false) {
        if (value instanceof TemplateResult) {
            this.templatePart.update(value, hydrate);
        }
        if (Array.isArray(value)) {
            for (let index = 0; index < value.length; index++) {
                if (value[index] instanceof TemplateResult) this.arrayParts[index].update(value[index], hydrate);
            }
        }
    }

    /**
     * Creates the nested parts for a value. When hydrating, nested template parts are bound to the server rendered
     * template-part markers between this part's markers.
     * @param {TemplateResult | any[] | any} value
     * @param {boolean} hydrate
     * @return {TemplatePart | Node | string | Array<TemplatePart | Node | string>}
     */
    parseValue(value, hydrate = false) {
        if (value instanceof TemplateResult) {
            if (!this.templatePart) {
                const startNode = hydrate ? this.markers.findNestedStartNode('template-part') : undefined;
                this.templatePart = new TemplatePart(startNode, value);
            } else if (this.templatePart.strings !== value.strings) {
                // this means we have a different TemplateResult here with maybe different parts also
                this.templatePart = new TemplatePart(undefined, value);
            }
            return this.templatePart;
        }
        if (Array.isArray(value)) {
            return this.parseArray(value, hydrate);
        }
        if (value?.nodeType) {
            return value;
        }
        if (value === null || value === undefined) {
            return value;
        }
        // Everything else will be rendered as TextNode
        return value.toString();
    }

    /**
     * Creates the template parts for the template items of an array, indexed like the items. A different template at
     * an index gets a new part, the nodes of the part that was there go away with the diff. Other items (text, nodes)
     * pass through, functions and nested arrays are resolved before, see update().
     * @param {any[]} values
     * @param {boolean} hydrate
     * @return {Array<TemplatePart | Node | string>}
     */
    parseArray(values, hydrate = false) {
        const parsedValues = [];
        // the server rendered template-part markers directly between this part's markers, one per nested template.
        // Other values (text, nodes) have no marker, so the templates are counted separately
        const nestedStartNodes = hydrate ? this.markers.findNestedStartNodes('template-part') : [];
        let nestedIndex = 0;

        for (let index = 0; index < values.length; index++) {
            const value = values[index];
            if (value instanceof TemplateResult) {
                let templatePart = this.arrayParts[index];
                if (!templatePart || templatePart.strings !== value.strings) {
                    templatePart = new TemplatePart(nestedStartNodes[nestedIndex], value);
                    this.arrayParts[index] = templatePart;
                }
                nestedIndex++;
                parsedValues[index] = templatePart;
            } else {
                parsedValues[index] = value;
            }
        }
        // the parts of items beyond the new length are released, their nodes go away with the diff
        this.arrayParts.length = values.length;

        return parsedValues;
    }
}
