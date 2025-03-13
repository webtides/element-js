import { COMMENT_NODE, ELEMENT_NODE } from '../util/DOMHelper.js';
import { Part } from './Part.js';
import { TemplateResult } from './TemplateResult.js';
import { TemplatePart } from './TemplatePart.js';

/**
 * @param {Element} commentNode
 * @param {Element[]} nodes
 */
const insertNodesBetweenComments = (commentNode, nodes) => {
    for (const node of nodes) {
        commentNode.parentNode.insertBefore(node, commentNode);
    }
};

/**
 * @param {Element} commentNode
 */
const removeNodesBetweenComments = (commentNode) => {
    while (commentNode.previousSibling) {
        if (
            commentNode.previousSibling.nodeType === COMMENT_NODE &&
            commentNode.previousSibling.data === commentNode.data.replace('/', '')
        ) {
            break;
        }
        commentNode.parentNode.removeChild(commentNode.previousSibling);
    }
};

/**
 * @param {Node} parentNode
 * @param {Node[]} domChildNodes
 * @param {Node[]} templateChildNodes
 * @param {Node} anchorNode
 * @return {Node[]}
 */
const diffChildNodes = function (parentNode, domChildNodes, templateChildNodes, anchorNode) {
    // TODO: when diffing arrays there is sometimes two lists of TemplateParts instead of lists of childNodes
    const offset = domChildNodes.includes(anchorNode) ? 1 : 0;

    // release first level references to prevent cache mutation
    const clonedDomChildNodes = [...domChildNodes];
    const clonedTemplateChildNodes = [...templateChildNodes];

    // We always want to have the two arrays (domChildNodes and cloneTemplateChildNodes) to have the same length.
    // We also don't ever want to replace/diff the last node of the domChildNodes as it will always be the
    // closing comment marker (/template-part) aka the anchorNode. So we push it to the end by inserting undefined items.
    if (clonedTemplateChildNodes.length > clonedDomChildNodes.length) {
        const nodesToFill = clonedTemplateChildNodes.length - clonedDomChildNodes.length;
        for (let i = 0; i < nodesToFill; i++) {
            clonedDomChildNodes.splice(clonedDomChildNodes.length - offset, 0, undefined);
        }
    }

    if (clonedDomChildNodes.length > clonedTemplateChildNodes.length) {
        const nodesToFill = clonedDomChildNodes.length - clonedTemplateChildNodes.length;
        for (let i = 0; i < nodesToFill; i++) {
            clonedTemplateChildNodes.splice(clonedTemplateChildNodes.length - offset, 0, undefined);
        }
    }

    const length = clonedDomChildNodes.length;
    // Diff each node in the child node lists
    for (let index = 0; index < length; index++) {
        let domChildNode = clonedDomChildNodes[index];
        let templateChildNode = clonedTemplateChildNodes[index];

        // If the DOM node doesn't exist, append/copy the template node
        if (domChildNode === undefined) {
            if (typeof templateChildNode === 'object' && 'ELEMENT_NODE' in templateChildNode) {
                parentNode.insertBefore(templateChildNode, anchorNode);
            } else {
                // TODO: this might not be performant?! Can we maybe handle this in processDomNode?!
                // TODO: I think that we need to make ChildNodeParts from all primitive values as well
                parentNode.insertBefore(document.createTextNode(templateChildNode), anchorNode);
            }
            continue;
        }

        if (templateChildNode === undefined) {
            // If the template node doesn't exist, remove the node in the DOM
            if ('ELEMENT_NODE' in domChildNode) {
                // remove dom node
                parentNode.removeChild(domChildNode);
            } else if (Array.isArray(domChildNode) || domChildNode instanceof TemplatePart) {
                // remove childNodes
                const childNodes = Array.isArray(domChildNode) ? domChildNode : domChildNode.childNodes;
                for (const childNode of childNodes) {
                    childNode.remove();
                }
            } else {
                console.log('This should not happen... what do we do about this node?!', { domChildNode });
            }
            continue;
        }

        // If DOM node is equal to the template node, don't do anything in the DOM
        if (
            domChildNode === templateChildNode ||
            (domChildNode.nodeType && templateChildNode.nodeType && domChildNode.isEqualNode(templateChildNode))
        ) {
            // but we need to assign the current DOM node into the templateChildNodes
            // as they will be returned here at the end and become the domNodes for the next diffing.
            const childIndex = templateChildNodes.indexOf(templateChildNode);
            templateChildNodes[childIndex] = domChildNode;
            continue;
        }

        // Everything else is somehow different and can be replaced
        if (parentNode.contains(domChildNode)) {
            parentNode.replaceChild(templateChildNode, domChildNode);
        } else {
            console.warn('This should not happen', {
                parentNode,
                'parentNode.contains(domChildNode)': parentNode.contains(domChildNode),
                templateChildNode,
                domChildNode,
            });
        }
    }
    return templateChildNodes;
};

/**
 * @param {Node} comment
 * @param {TemplatePart | any[] | any} initialValue
 * @return {(function(*): void)|*}
 */
export const processNodePart = (comment, initialValue) => {
    let nodes = initialValue instanceof TemplatePart ? initialValue.childNodes : [];
    let oldValue = initialValue instanceof TemplatePart ? initialValue.strings : initialValue;
    // this is for string values to be inserted into the DOM. A cached TextNode will be used so that we don't have to constantly create new DOM nodes.
    let cachedTextNode = undefined;

    const processNodeValue = (newValue) => {
        switch (typeof newValue) {
            // primitives are handled as text content
            case 'string':
            case 'number':
            case 'boolean':
                if (oldValue !== newValue) {
                    oldValue = newValue;
                    if (!cachedTextNode) cachedTextNode = globalThis.document?.createTextNode('');
                    cachedTextNode.data = newValue;

                    if (comment.previousSibling?.data === comment.data.replace('/', '')) {
                        // the part is empty - we haven't rendered it yet
                        comment.parentNode.insertBefore(cachedTextNode, comment);
                    } else {
                        // the part was already rendered (either server side or on the client)
                        comment.previousSibling.data = newValue;
                    }

                    nodes = [cachedTextNode];
                }
                break;
            // null (= typeof "object") and undefined are used to clean up previous content
            case 'object':
            case 'undefined':
                if (newValue === null || newValue === undefined) {
                    if (oldValue !== newValue) {
                        oldValue = newValue;
                        removeNodesBetweenComments(comment);
                        nodes = [];
                    }
                    break;
                }
                if (Array.isArray(newValue)) {
                    if (newValue.length === 0) {
                        removeNodesBetweenComments(comment);
                        nodes = [];
                    } else {
                        // TODO: this will always diff the arrays although they might not have changed...
                        const unwrapArray = (nodes) => {
                            // we have to unwrap any complex objects inside the array so that we can diff arrays of childNodes
                            return nodes.flatMap((value) => {
                                if (value instanceof TemplatePart) {
                                    return value.childNodes;
                                }
                                if (Array.isArray(value)) {
                                    return unwrapArray(value);
                                }
                                return value;
                            });
                        };
                        nodes = diffChildNodes(comment.parentNode, nodes, unwrapArray(newValue), comment);
                    }
                    oldValue = newValue;
                    break;
                }

                // TODO: sometimes the strings are the same, but the value types have changed eg. from array to templatepart - then we must also diff!!
                if (newValue instanceof TemplatePart && oldValue !== newValue.strings) {
                    // if the new value is a node or a fragment, and it's different from the live node, then it's diffed.
                    // static strings have changed in tpl part
                    oldValue = newValue.strings;
                    nodes = diffChildNodes(comment.parentNode, nodes, newValue.childNodes, comment);
                } else if (oldValue !== newValue && 'ELEMENT_NODE' in newValue) {
                    // DOM Node changed, needs diffing
                    oldValue = newValue;
                    nodes = diffChildNodes(comment.parentNode, nodes, [newValue], comment);
                }
                break;
            case 'function':
                processNodeValue(newValue(comment));
                break;
        }
    };

    return processNodeValue;
};

/**
 * For updating a text node, a sequence of child nodes or an array of `any` values
 */
export class ChildNodePart extends Part {
    // TODO: this is only for array values
    /** @type {Part[]} */
    parts = [];

    // TODO: this is only for TemplatePart values
    templatePart = undefined;

    // TODO: maybe we can store a generic vale|parsedValue that can be either parts[] | templatePart | any

    /** @type {Node[]} */
    childNodes = [];

    /**
     * @param {Node} startNode - the start comment marker node
     * @param {any | any[]} value
     */
    constructor(startNode, value) {
        if (startNode && startNode?.nodeType !== COMMENT_NODE) {
            throw new Error('ChildNodePart: startNode is not a comment node');
        }

        super();

        let endNode = undefined;
        let serverSideRendered = false;
        if (startNode) {
            startNode.__part = this; // add Part to comment node for debugging in the browser

            const placeholder = startNode.data;
            const childNodes = [startNode];
            let childNode = startNode.nextSibling;
            while (childNode && childNode.data !== `/${placeholder}`) {
                childNodes.push(childNode);
                childNode = childNode.nextSibling;
            }

            endNode = childNode;
            childNodes.push(endNode);

            // if not SSRed, childNodes will only ever have two comment nodes, the start and the end marker
            if (childNodes.length > 2) {
                serverSideRendered = true;
            }

            this.childNodes = childNodes;
        }

        // value can become array | TemplatePart | any
        const initialValue = this.parseValue(value);

        if (endNode) {
            this.processor = processNodePart(endNode, serverSideRendered ? initialValue : undefined);
        }

        if (!serverSideRendered) {
            if (value instanceof TemplateResult || Array.isArray(value)) {
                this.updateParts(value);
            }

            if (!(value instanceof TemplateResult)) {
                this.processor?.(initialValue);
            }
        }
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

        if (!(value instanceof TemplateResult)) {
            this.processor?.(parsedValue);
        }
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
                this.parts[index]?.update(value[index]);
            }
        }
    }

    /**
     * @param {TemplateResult | any[] | any} value
     * @return {TemplatePart | any[] | any}
     */
    parseValue(value) {
        if (value instanceof TemplateResult) {
            if (!this.templatePart) {
                const startNode = Array.from(this.childNodes)
                    .filter((node) => node.nodeType === COMMENT_NODE)
                    .find((node) => node.data === 'template-part');
                this.templatePart = new TemplatePart(startNode, value);
                const serverSideRendered = startNode !== undefined;
                if (!serverSideRendered) {
                    // TODO: we should already have the "endNode" from the constructor...
                    const endNode = Array.from(this.childNodes)
                        .filter((node) => node.nodeType === COMMENT_NODE)
                        .find((node) => node.data.includes('/dom-part-'));
                    // INFO: this is similar to TemplateResult#237
                    insertNodesBetweenComments(endNode, this.templatePart.childNodes);
                }
            }
            return this.templatePart;
        }
        if (Array.isArray(value)) {
            return this.parseArray(value);
        }
        return value;
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

            if (value instanceof TemplateResult) {
                // TODO this is probably wrong. Should only be taken from parts cache if it has the same type (eg. template vs string, mixed types arrays)
                let templatePart = this.parts[index];
                if (!templatePart) {
                    const templatePartCommentNodes = this.childNodes?.filter(
                        (node) => node && node.nodeType === COMMENT_NODE && node.data === 'template-part',
                    );
                    const startNode = templatePartCommentNodes[index];
                    templatePart = new TemplatePart(startNode, value);
                    this.parts[index] = templatePart;
                }
                parsedValues[index] = templatePart;
            } else if (Array.isArray(value)) {
                let childNodePart = this.parts[index];
                if (!childNodePart) {
                    // TODO: this seems not correct :( (maybe Template vs DOM Parts !?)
                    const templatePartCommentNodes = this.childNodes?.filter(
                        (node) => node && node.nodeType === COMMENT_NODE && node.data === 'template-part',
                    );
                    const startNode = templatePartCommentNodes[index];
                    childNodePart = new ChildNodePart(startNode, value);
                    this.parts[index] = childNodePart;
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
