import { COMMENT_NODE, TEXT_NODE } from '../util/DOMHelper.js';
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
 * @param {TemplatePart | any[] | any} parsedValue
 * @return {boolean} true if every template part in the value is bound to server rendered DOM
 */
const isBoundToLiveNodes = (parsedValue) => {
    if (parsedValue instanceof TemplatePart) return parsedValue.hydrated;
    if (Array.isArray(parsedValue)) {
        return parsedValue.every((item) => !(item instanceof TemplatePart) || item.hydrated);
    }
    return true;
};

/**
 * Creates the processor that writes values between the markers of a child node part.
 * @param {Comment} comment - the end marker
 * @return {{update: (function(*): void), hydrate: (function(*): void)}}
 */
export const processNodePart = (comment) => {
    let oldValueType = 'empty';
    let oldValue = undefined;
    // string values are rendered into one text node that is reused across updates
    let cachedTextNode = globalThis.document?.createTextNode('');

    const getNodesForType = (value, type) => {
        if (type === 'templatePart') return value.childNodes;
        if (type === 'array') return unwrapArray(value);
        if (type === 'node') return [value];

        // Every else falls back to rendering a text node
        cachedTextNode.data = value;
        return [cachedTextNode];
    };

    /**
     * @param {TemplatePart | any[] | any} newValue
     */
    const update = (newValue) => {
        const newValueType = getType(newValue);

        if (oldValueType === newValueType && oldValue === newValue) return;

        if (oldValueType !== newValueType) {
            if (newValueType === 'empty') {
                removeNodesBetweenComments(comment);
            } else {
                replaceNodesBetweenComments(comment, getNodesForType(newValue, newValueType));
            }
        } else if (newValueType === 'text') {
            cachedTextNode.data = newValue;
        } else if (newValueType === 'templatePart') {
            // a different template, its nodes replace the previous ones
            replaceNodesBetweenComments(comment, newValue.childNodes);
        } else if (newValueType === 'array') {
            diffChildNodes(unwrapArray(newValue), comment);
        } else if (newValueType === 'node') {
            diffChildNodes([newValue], comment);
        }

        oldValueType = newValueType;
        oldValue = newValue;
    };

    /**
     * Seeds the processor with what the server rendered between the markers, without touching it. Text is adopted
     * from the DOM so that the next update diffs against the real content. Template parts, arrays and nodes were
     * bound to the server rendered markers by parseValue() already.
     * @param {TemplatePart | any[] | any} parsedValue
     */
    const hydrate = (parsedValue) => {
        const type = getType(parsedValue);
        if (type !== 'text' && type !== 'empty') {
            oldValueType = type;
            oldValue = parsedValue;
            return;
        }

        const nodes = getNodesBetweenComments(comment);
        if (nodes.length === 0) {
            oldValueType = 'empty';
            oldValue = undefined;
            return;
        }
        if (nodes.length === 1 && nodes[0].nodeType === TEXT_NODE) {
            cachedTextNode = nodes[0];
        } else {
            cachedTextNode.data = nodes.map((node) => node.textContent).join('');
            replaceNodesBetweenComments(comment, [cachedTextNode]);
        }
        oldValueType = 'text';
        oldValue = cachedTextNode.data;
    };

    return { update, hydrate };
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
     */
    update(value) {
        const resolvedValue = typeof value === 'function' ? value() : value;
        const parsedValue = this.parseValue(resolvedValue, false);
        this.updateParts(resolvedValue);
        this.processor.update(parsedValue);
    }

    /**
     * @param {TemplateResult | any[] | any} value
     */
    hydrate(value) {
        const resolvedValue = typeof value === 'function' ? value() : value;
        const parsedValue = this.parseValue(resolvedValue, true);
        this.hydrateParts(resolvedValue);
        if (isBoundToLiveNodes(parsedValue)) {
            this.processor.hydrate(parsedValue);
        } else {
            // the server rendered a different structure than the client expects, apply the client value
            this.processor.update(parsedValue);
        }
    }

    /**
     * @param {TemplateResult | any[] | any} value
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
     */
    hydrateParts(value) {
        if (value instanceof TemplateResult) {
            this.templatePart.hydrate(value);
        }
        if (Array.isArray(value)) {
            for (let index = 0; index < value.length; index++) {
                this.arrayParts[index]?.hydrate(value[index]);
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
        if (typeof value === 'function') {
            return this.parseValue(value(), hydrate);
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
        // the server rendered template-part markers directly between this part's markers, one per nested template
        const nestedStartNodes = hydrate ? this.markers.findNestedStartNodes('template-part') : [];

        for (let index = 0; index < values.length; index++) {
            let value = values[index];

            // TODO: it would be better to use this.parseValue() here!!!

            if (value instanceof TemplateResult) {
                // TODO this is probably wrong. Should only be taken from parts cache if it has the same type (eg. template vs string, mixed types arrays)
                let templatePart = this.arrayParts[index];
                if (!templatePart) {
                    templatePart = new TemplatePart(nestedStartNodes[index], value);
                    this.arrayParts[index] = templatePart;
                }
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
