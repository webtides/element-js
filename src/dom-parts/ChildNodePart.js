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
 * @param {Node[]} newChildNodes
 * @param {Comment} anchorNode
 */
const diffChildNodes = function (newChildNodes, anchorNode) {
    const parentNode = anchorNode.parentNode;
    const oldChildNodes = getNodesBetweenComments(anchorNode);

    const length = Math.max(oldChildNodes.length, newChildNodes.length);
    // Diff each node in the child node lists
    for (let index = 0; index < length; index++) {
        let oldChildNode = oldChildNodes[index];
        let newChildNode = newChildNodes[index];

        if (newChildNode && !newChildNode.nodeType) {
            throw new Error('ChildNodePart: newChildNode is not a node');
        }

        // If the DOM node doesn't exist, append/copy the new node
        if (oldChildNode === undefined) {
            parentNode.insertBefore(newChildNode, anchorNode);
            continue;
        }

        // If the new node doesn't exist, remove the node in the DOM
        if (newChildNode === undefined) {
            parentNode.removeChild(oldChildNode);
            continue;
        }

        // If DOM node is equal to the new node, don't do anything in the DOM
        if (oldChildNode === newChildNode || oldChildNode.isEqualNode(newChildNode)) {
            continue;
        }

        // Everything else is somehow different and can be replaced
        parentNode.replaceChild(newChildNode, oldChildNode);
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
 * @param {Comment} comment - the end marker
 * @return {(function(TemplatePart | any[] | any, boolean=): void)}
 */
export const processNodePart = (comment) => {
    let oldValueType = 'empty';
    let oldValue = undefined;
    // string values are rendered into one text node that is reused across updates
    const cachedTextNode = globalThis.document?.createTextNode('');

    return (newValue, hydrate = false) => {
        const newValueType = getType(newValue);

        if (oldValueType === newValueType && oldValue === newValue) return;

        if (newValueType === 'empty') {
            removeNodesBetweenComments(comment);
        } else if (newValueType === 'text') {
            cachedTextNode.data = newValue;
            if (oldValueType !== 'text') replaceNodesBetweenComments(comment, [cachedTextNode]);
        } else if (newValueType === 'templatePart') {
            // a template part bound to server rendered DOM (hydration) is in place already and is left alone
            if (newValue.childNodes[0].parentNode !== comment.parentNode) {
                replaceNodesBetweenComments(comment, newValue.childNodes);
            }
        } else {
            const nodes = newValueType === 'array' ? unwrapArray(newValue) : [newValue];
            // a type change replaces what is there. Server rendered nodes (hydration) go through the diff instead,
            // nodes that are in place already, for example a focused input, stay untouched
            if (oldValueType !== newValueType && !hydrate) {
                replaceNodesBetweenComments(comment, nodes);
            } else {
                diffChildNodes(nodes, comment);
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
        this.processor = processNodePart(this.markers.endNode);
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
