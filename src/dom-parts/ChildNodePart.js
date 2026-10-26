import { COMMENT_NODE } from '../util/DOMHelper.js';
import { Part } from './Part.js';
import { TemplateResult } from './TemplateResult.js';
import { TemplatePart } from './TemplatePart.js';
import { PartMarkers } from './PartMarkers.js';

/**
 * @param {Comment} commentNode
 * @param {Node[]} nodes
 */
export const insertNodesBetweenComments = (commentNode, nodes) => {
    for (const node of nodes) {
        commentNode.parentNode.insertBefore(node, commentNode);
    }
};

/**
 * @param {Comment} commentNode
 * @param {Node[]} nodes
 */
export const replaceNodesBetweenComments = (commentNode, nodes) => {
    removeNodesBetweenComments(commentNode);
    for (const node of nodes) {
        if (!commentNode.parentNode) {
            console.error(`--- no parent comment ---`);
        }
        commentNode.parentNode.insertBefore(node, commentNode);
    }
};

/**
 * @param {Comment} commentNode
 */
export const removeNodesBetweenComments = (commentNode) => {
    const nodes = getNodesBetweenComments(commentNode);
    for (const node of nodes) {
        commentNode.parentNode.removeChild(node);
    }
};

/**
 * @param {Comment} commentNode
 * @param {boolean} includeComments
 * @return {Node[]}
 */
export const getNodesBetweenComments = (commentNode, includeComments = false) => {
    const nodes = [];
    let currentNode = includeComments ? commentNode : commentNode.previousSibling;
    let nestingLevel = 0;

    while (currentNode) {
        if (includeComments) nodes.unshift(currentNode);

        if (currentNode.nodeType === COMMENT_NODE && currentNode.data === commentNode.data) {
            nestingLevel++;
        }

        if (currentNode.nodeType === COMMENT_NODE && currentNode.data === commentNode.data.replace('/', '')) {
            if (nestingLevel === 0) {
                break;
            }
            nestingLevel--;
        }

        if (!includeComments) nodes.unshift(currentNode);
        currentNode = currentNode.previousSibling;
    }
    return nodes;
};

/**
 * Brings the nodes between the markers in line with newChildNodes, in that order. Walks the live DOM with a cursor
 * instead of a snapshot: a node that is at the cursor already stays, a node that is in the DOM further back, for
 * example a hydrated template behind a server rendered text, moves up in front of the cursor, anything else replaces
 * what the cursor points at. Whatever is left at the end is removed.
 * @param {Node[]} newChildNodes
 * @param {Comment} startNode - the start marker
 * @param {Comment} endNode - the end marker
 */
const diffChildNodes = (newChildNodes, startNode, endNode) => {
    const parentNode = endNode.parentNode;
    let current = startNode.nextSibling;
    for (let index = 0; index < newChildNodes.length; index++) {
        const newChildNode = newChildNodes[index];
        if (!newChildNode?.nodeType) {
            throw new Error('ChildNodePart: newChildNode is not a node');
        }
        if (current === newChildNode) {
            current = current.nextSibling;
        } else if (current === endNode || newChildNode.parentNode === parentNode) {
            parentNode.insertBefore(newChildNode, current);
        } else if (!newChildNode.parentNode && current.isEqualNode(newChildNode)) {
            // only a detached node is compared by value: a fresh text node does not replace an equal one, the nodes
            // of a template clone, which still sit in their fragment, always replace what the server rendered
            current = current.nextSibling;
        } else {
            const next = current.nextSibling;
            parentNode.replaceChild(newChildNode, current);
            current = next;
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

// TODO: handle funcitons?! Should be handled in parseArray!!!
const unwrapArray = (nodes) => {
    // we have to unwrap any complex objects inside the array so that we can diff arrays of childNodes
    return nodes.flatMap((value) => {
        if (value instanceof TemplatePart) {
            return value.childNodes;
        }
        if (Array.isArray(value)) {
            return unwrapArray(value);
        }
        if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
            return document.createTextNode(value);
        }
        return value;
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
    // string values are rendered into one text node that is reused across updates
    const cachedTextNode = globalThis.document?.createTextNode('');

    return (newValue, hydrate = false) => {
        const newValueType = getType(newValue);

        if (oldValueType === newValueType && oldValue === newValue) return;

        if (newValueType === 'empty') {
            removeNodesBetweenComments(endNode);
        } else if (newValueType === 'text') {
            cachedTextNode.data = newValue;
            if (oldValueType !== 'text') replaceNodesBetweenComments(endNode, [cachedTextNode]);
        } else if (newValueType === 'templatePart') {
            // a template part bound to server rendered DOM (hydration) is in place already and is left alone
            if (newValue.childNodes[0].parentNode !== endNode.parentNode) {
                replaceNodesBetweenComments(endNode, newValue.childNodes);
            }
        } else {
            const nodes = newValueType === 'array' ? unwrapArray(newValue) : [newValue];
            // a type change replaces what is there. Server rendered nodes (hydration) go through the diff instead,
            // nodes that are in place already, for example a focused input, stay untouched
            if (oldValueType !== newValueType && !hydrate) {
                replaceNodesBetweenComments(endNode, nodes);
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

    /** @type {Part[]} */
    arrayParts = [];

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
        // functions are resolved completely, parsing and updating have to work on the same value
        let resolvedValue = value;
        while (typeof resolvedValue === 'function') resolvedValue = resolvedValue();
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
                this.arrayParts[index]?.update(value[index], hydrate);
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
     * Nested TemplateResults values need to be unrolled in order for update functions to be able to process them
     * @param {any[]} values
     * @param {boolean} hydrate
     * @return {any[]}
     */
    parseArray(values, hydrate = false) {
        const parsedValues = [];
        // the server rendered template-part markers directly between this part's markers, one per nested template.
        // Other values (text, nodes) have no marker, so the templates are counted separately
        const nestedStartNodes = hydrate ? this.markers.findNestedStartNodes('template-part') : [];
        let nestedIndex = 0;

        for (let index = 0; index < values.length; index++) {
            let value = values[index];

            // TODO: it would be better to use this.parseValue() here!!!

            if (value instanceof TemplateResult) {
                // TODO this is probably wrong. Should only be taken from parts cache if it has the same type (eg. template vs string, mixed types arrays)
                let templatePart = this.arrayParts[index];
                if (!templatePart) {
                    templatePart = new TemplatePart(nestedStartNodes[nestedIndex], value);
                    this.arrayParts[index] = templatePart;
                }
                nestedIndex++;
                parsedValues[index] = templatePart;
            } else if (Array.isArray(value)) {
                let childNodePart = this.arrayParts[index];
                if (!childNodePart) {
                    // TODO: this seems not correct :( (maybe Template vs DOM Parts !?)
                    childNodePart = new ChildNodePart(nestedStartNodes[index]);
                    this.arrayParts[index] = childNodePart;
                }
                parsedValues[index] = childNodePart;
            } else {
                // TODO: what if the value from the function is a TemplatePart or an array?! Should we do this first thing?!
                parsedValues[index] = typeof value === 'function' ? value() : value;
            }
        }

        return parsedValues;
    }
}
