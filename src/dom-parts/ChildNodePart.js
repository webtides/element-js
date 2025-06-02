import { COMMENT_NODE, ELEMENT_NODE } from '../util/DOMHelper.js';
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
 * @param {Comment} comment
 * @param {TemplatePart | any[] | any} initialValue
 * @param {boolean} serverSideRendered
 * @return {(function(*): void)|*}
 */
export const processNodePart = (comment, initialValue, serverSideRendered = false) => {
    let oldValueType = 'empty';
    let oldValue = undefined;
    // this is for string values to be inserted into the DOM. A cached TextNode will be used so that we don't have to constantly create new DOM nodes.
    // TODO: when server side rendered, we need to get the text node from the DOM no?!
    let cachedTextNode = globalThis.document?.createTextNode('');

    if (serverSideRendered) {
        oldValueType = getType(initialValue);
        oldValue = initialValue instanceof TemplatePart ? initialValue.strings : initialValue;
    }

    const processNodeValue = (newValue) => {
        let newValueType = getType(newValue);

        if (oldValueType === newValueType && oldValue === newValue) return;

        if (oldValueType !== newValueType) {
            if (newValueType === 'empty') {
                removeNodesBetweenComments(comment);
            } else {
                const getNodesForType = (value, type) => {
                    if (type === 'templatePart') return value.childNodes;
                    if (type === 'array') return unwrapArray(value);
                    if (type === 'node') return [value];

                    // Every else falls back to rendering a text node
                    cachedTextNode.data = value;
                    return [cachedTextNode];
                };
                replaceNodesBetweenComments(comment, getNodesForType(newValue, newValueType));
            }

            oldValueType = newValueType;
            oldValue = newValue;
            return;
        }

        if (newValueType === 'text') {
            cachedTextNode.data = newValue;

            oldValue = newValue;
            return;
        }

        if (newValueType === 'array') {
            diffChildNodes(unwrapArray(newValue), comment);

            oldValue = newValue;
            return;
        }

        if (newValueType === 'node') {
            diffChildNodes([newValue], comment);

            oldValue = newValue;
        }
    };

    if (!serverSideRendered) {
        // initial rendering
        processNodeValue(initialValue);
    }

    return processNodeValue;
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
     * @param {any | any[]} value
     */
    constructor(startNode, value) {
        if (!startNode || startNode?.nodeType !== COMMENT_NODE) {
            throw new Error(
                startNode ? 'ChildNodePart: startNode is undefined' : 'ChildNodePart: startNode is not a comment node',
            );
        }

        super();

        startNode.__part = this; // add Part to comment node for debugging in the browser
        this.markers = PartMarkers.createFromStartNode(startNode);

        // value can become array | TemplatePart | any
        const initialValue = this.parseValue(value);

        this.processor = processNodePart(this.markers?.endNode, initialValue, this.markers?.serverSideRendered);
    }

    /**
     * @param {any} value
     * @return {*}
     */
    update(value) {
        const parsedValue = this.parseValue(value);

        if (value instanceof TemplateResult || Array.isArray(value)) {
            this.updateParts(value);
        }

        this.processor?.(parsedValue);
    }

    /**
     * @param {TemplateResult | any[]} value
     */
    updateParts(value) {
        if (value instanceof TemplateResult) {
            this.templatePart.update(value);
        }
        if (Array.isArray(value)) {
            for (let index = 0; index < value.length; index++) {
                this.arrayParts[index]?.update(value[index]);
            }
        }
    }

    /**
     * @param {TemplateResult | any[] | any} value
     * @return {TemplatePart | Node | string | Array<TemplatePart | Node | string>}
     */
    parseValue(value) {
        if (value instanceof TemplateResult) {
            if (!this.templatePart) {
                this.templatePart = new TemplatePart(this.markers?.findNestedStartNode('template-part'), value);
                if (!this.markers?.serverSideRendered) {
                    // INFO: this is similar to TemplateResult#237
                    replaceNodesBetweenComments(this.markers?.endNode, this.templatePart.childNodes);
                }
            } else if (this.templatePart.strings !== value.strings) {
                // this means we have a different TemplateResult here with maybe different parts also
                this.templatePart = new TemplatePart(undefined, value);
                // INFO: this is similar to TemplateResult#237
                replaceNodesBetweenComments(this.markers?.endNode, this.templatePart.childNodes);
            }
            return this.templatePart;
        }
        if (Array.isArray(value)) {
            return this.parseArray(value);
        }
        if (value?.nodeType) {
            return value;
        }
        if (typeof value === 'function') {
            return this.parseValue(value());
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
     * @return {any[]}
     */
    parseArray(values) {
        const parsedValues = [];
        for (let index = 0; index < values.length; index++) {
            let value = values[index];

            // TODO: it would be better to use this.parseValue() here!!!

            if (value instanceof TemplateResult) {
                // TODO this is probably wrong. Should only be taken from parts cache if it has the same type (eg. template vs string, mixed types arrays)
                let templatePart = this.arrayParts[index];
                if (!templatePart) {
                    const templatePartCommentNodes = this.markers?.childNodes?.filter(
                        (node) => node && node.nodeType === COMMENT_NODE && node.data === 'template-part',
                    );
                    const startNode = templatePartCommentNodes[index];
                    templatePart = new TemplatePart(startNode, value);
                    this.arrayParts[index] = templatePart;
                }
                parsedValues[index] = templatePart;
            } else if (Array.isArray(value)) {
                let childNodePart = this.arrayParts[index];
                if (!childNodePart) {
                    // TODO: this seems not correct :( (maybe Template vs DOM Parts !?)
                    const templatePartCommentNodes = this.markers?.childNodes?.filter(
                        (node) => node && node.nodeType === COMMENT_NODE && node.data === 'template-part',
                    );
                    const startNode = templatePartCommentNodes[index];
                    childNodePart = new ChildNodePart(startNode, value);
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
