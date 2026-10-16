import { COMMENT_NODE, convertStringToTemplate } from '../util/DOMHelper.js';
import { Part } from './Part.js';
import { AttributePart } from './AttributePart.js';
import { ChildNodePart, getNodesBetweenComments, replaceNodesBetweenComments } from './ChildNodePart.js';
import { NodePart } from './NodePart.js';
import { RawTextNodePart } from './RawTextNodePart.js';
import { PartMarkers, walkPartMarkers } from './PartMarkers.js';

/** @type {WeakMap<TemplateStringsArray, DocumentFragment>} */
const fragmentsCache = new WeakMap();

/** @type {WeakMap<TemplateStringsArray, {descriptors: object[], markerData: string[], hasRootNodeParts: boolean}>} */
const partsCache = new WeakMap();

/**
 * The parsed template for a `strings` array: the fragment to clone, the part descriptors in part order, the comment
 * data of each part marker and whether a node part sits at the root of the template. All computed once per literal.
 * @param {TemplateResult} templateResult
 * @return {{fragment: DocumentFragment, descriptors: object[], markerData: string[], hasRootNodeParts: boolean}}
 */
const parseTemplate = (templateResult) => {
    let fragment = fragmentsCache.get(templateResult.strings);
    if (!fragment) {
        fragment = convertStringToTemplate(templateResult.templateString);
        fragmentsCache.set(templateResult.strings, fragment);
    }
    let parts = partsCache.get(templateResult.strings);
    if (!parts) {
        const descriptors = templateResult.parseParts(fragment.childNodes);
        const markerData = [];
        let hasRootNodeParts = false;
        walkPartMarkers(fragment.firstChild, (node, index) => {
            markerData[index] = node.data;
            if (descriptors[index].type === 'node' && node.parentNode === fragment) hasRootNodeParts = true;
        });
        parts = { descriptors, markerData, hasRootNodeParts };
        partsCache.set(templateResult.strings, parts);
    }
    return { fragment, ...parts };
};

/**
 * One rendered instance of a template. Binds the parts of the template to DOM nodes: either to a fresh clone of the
 * template fragment, or, when hydrating, to the markers in server rendered DOM. Both bindings walk the same comment
 * markers, see walkPartMarkers(). Construction only binds, values flow through update().
 */
export class TemplatePart extends Part {
    /** @type {PartMarkers} */
    markers;

    /** @type {Part[]} indexed like the values of the template */
    parts = [];

    /** @type {TemplateStringsArray} */
    strings = undefined;

    /**
     * The top level nodes of this instance, including its template-part markers and the content of parts at the root
     * of the template. Refreshed after every update while the nodes are attached, kept as is while they are detached
     * so that a removed instance can be inserted again.
     * @type {Node[]}
     */
    childNodes = [];

    /** @type {boolean} true when the parts are bound to server rendered DOM */
    hydrated = false;

    /** @type {boolean} true when a node part at the root of the template can change the top level nodes */
    hasRootNodeParts = false;

    /**
     * @param {Comment|undefined} startNode - the `<!--template-part-->` comment of server rendered DOM to hydrate, or undefined to render client side
     * @param {TemplateResult} templateResult
     */
    constructor(startNode, templateResult) {
        if (startNode && startNode.nodeType !== COMMENT_NODE) {
            throw new Error('TemplatePart: startNode is not a comment node');
        }

        super();

        if (startNode) {
            startNode.__part = this; // add Part to comment node for debugging in the browser
            this.hydrated = this.bindLive(startNode, templateResult);
        }
        if (!this.hydrated) {
            this.bindClone(templateResult);
        }
    }

    /**
     * @param {TemplateResult} templateResult
     * @param {boolean} [hydrate] - first update of server rendered DOM: nested parts bind to the server rendered
     *   markers instead of cloning, see ChildNodePart.parseValue(). Nodes that are in place already stay untouched.
     */
    update(templateResult, hydrate = false) {
        if (this.strings !== templateResult.strings) {
            // a different template: render it fresh and swap the content between the existing markers
            const { startNode, endNode } = this.markers;
            this.bindClone(templateResult);
            const innerNodes = this.childNodes.slice(1, -1);
            replaceNodesBetweenComments(endNode, innerNodes);
            this.markers = new PartMarkers(startNode, endNode, [startNode, ...innerNodes, endNode]);
            this.childNodes = this.markers.childNodes;
            this.hydrated = false;
        }
        // an instance that could not be bound to server DOM is a fresh clone, its parts clone as well
        this.updateParts(templateResult.values, hydrate && this.hydrated);
        if (this.hasRootNodeParts) this.refreshChildNodes();
    }

    /**
     * @param {any[]} values
     * @param {boolean} [hydrate]
     */
    updateParts(values, hydrate = false) {
        for (let index = 0; index < values.length; index++) {
            this.parts[index]?.update(values[index], hydrate);
        }
    }

    /**
     * Re-reads the top level nodes between the markers. Parts at the root of the template insert and remove their
     * content there, so the list is only known after an update. Detached nodes have no siblings to walk, the last
     * known list is kept in that case.
     */
    refreshChildNodes() {
        const { startNode, endNode } = this.markers;
        if (startNode.parentNode) {
            this.childNodes = [startNode, ...getNodesBetweenComments(endNode), endNode];
        }
    }

    /**
     * Clones the template fragment and binds the parts to the markers in the clone.
     * @param {TemplateResult} templateResult
     */
    bindClone(templateResult) {
        const { fragment, descriptors, hasRootNodeParts } = parseTemplate(templateResult);
        const clone = globalThis.document.importNode(fragment, true);
        const startNode = clone.firstChild;
        startNode.__part = this; // add Part to comment node for debugging in the browser
        const parts = [];
        const endNode = walkPartMarkers(startNode, (node, index) => {
            parts[index] = this.createPart(descriptors[index], node, templateResult.values[index]);
        });
        this.parts = parts;
        this.strings = templateResult.strings;
        this.hasRootNodeParts = hasRootNodeParts;
        this.childNodes = [...clone.childNodes];
        this.markers = new PartMarkers(startNode, endNode, this.childNodes);
    }

    /**
     * Binds the parts to the markers of server rendered DOM.
     * @param {Comment} startNode - the live `<!--template-part-->` comment
     * @param {TemplateResult} templateResult
     * @return {boolean} false if the markers do not match the template, nothing is bound in that case
     */
    bindLive(startNode, templateResult) {
        const { descriptors, markerData, hasRootNodeParts } = parseTemplate(templateResult);
        const values = templateResult.values;
        const parts = [];
        let found = 0;
        let endNode;
        try {
            endNode = walkPartMarkers(startNode, (node, index) => {
                found++;
                // the marker must be the one the template would render at this position: same type, name and
                // static attribute content. Differences in the static markup around the markers are not detected.
                if (descriptors[index] && node.data === markerData[index]) {
                    parts[index] = this.createPart(descriptors[index], node, values[index]);
                }
            });
        } catch (error) {
            endNode = undefined;
        }

        const complete = found === descriptors.length && descriptors.every((_, index) => parts[index] !== undefined);
        if (!endNode || !complete) {
            console.warn(
                'element-js: the server rendered markers do not match the template, rendering client side instead.',
                { template: templateResult.templateString, startNode },
            );
            return false;
        }

        this.parts = parts;
        this.strings = templateResult.strings;
        this.hasRootNodeParts = hasRootNodeParts;
        this.markers = PartMarkers.createFromStartNode(startNode);
        this.childNodes = this.markers.childNodes;
        return true;
    }

    /**
     * @param {{type: string, name?: string, initialValue?: string}} descriptor
     * @param {Comment} node - the marker comment
     * @param {any} value - the first value, only needed for directives
     * @return {Part}
     */
    createPart(descriptor, node, value) {
        switch (descriptor.type) {
            case 'node':
                return new ChildNodePart(node);
            case 'attribute':
                return new AttributePart(node, descriptor.name, descriptor.initialValue);
            case 'raw-text-node':
                return new RawTextNodePart(node, descriptor.initialValue);
            case 'directive':
                return new NodePart(node, value);
            default:
                throw new Error(`TemplatePart: cannot create a part for type "${descriptor.type}"`);
        }
    }
}
