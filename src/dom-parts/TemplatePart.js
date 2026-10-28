import { COMMENT_NODE, convertStringToTemplate } from '../util/DOMHelper.js';
import { Part } from './Part.js';
import { AttributePart } from './AttributePart.js';
import { ChildNodePart, getNodesBetweenComments, replaceNodesBetweenComments } from './ChildNodePart.js';
import { DirectivePart } from './DirectivePart.js';
import { TextContentPart } from './TextContentPart.js';
import { PartMarkers, walkPartMarkers } from './PartMarkers.js';
import { templateHashOf } from './markers.js';
import { parseTemplate } from './parseTemplate.js';

/**
 * One rendered instance of a template. Binds the parts of the template to DOM nodes: either to a fresh clone of the
 * template fragment, or, when hydrating, to the markers in server rendered DOM. Both bindings walk the same comment
 * markers, see walkPartMarkers(), and create the parts from the descriptors of the literal, see parseTemplate().
 * Construction only binds, values flow through update().
 */
export class TemplatePart extends Part {
    /** @type {PartMarkers} */
    markers;

    /** @type {Part[]} one per descriptor of the template, in document order */
    parts = [];

    /** @type {TemplateStringsArray} */
    strings = undefined;

    /**
     * The top level nodes of this instance, including its template markers and the content of parts at the root
     * of the template. Refreshed after every update while the nodes are attached, kept as is while they are detached
     * so that a removed instance can be inserted again.
     * @type {Node[]}
     */
    childNodes = [];

    /** @type {boolean} true when the parts are bound to server rendered DOM */
    hydrated = false;

    /** @type {boolean} true when a child node part at the root of the template can change the top level nodes */
    hasRootNodeParts = false;

    /**
     * @param {Comment|undefined} startNode - the template start marker of server rendered DOM to hydrate, or undefined to render client side
     * @param {import('./TemplateResult.js').TemplateResult} templateResult
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
     * @param {import('./TemplateResult.js').TemplateResult} templateResult
     */
    update(templateResult) {
        if (this.strings !== templateResult.strings) {
            // a different template: render it fresh and swap the content between the existing markers
            const { startNode, endNode } = this.markers;
            this.bindClone(templateResult);
            const innerNodes = this.childNodes.slice(1, -1);
            replaceNodesBetweenComments(startNode, endNode, innerNodes);
            // the markers stay, the start marker names the literal that is rendered now
            startNode.data = this.markers.startNode.data;
            this.markers = new PartMarkers(startNode, endNode, [startNode, ...innerNodes, endNode]);
            this.childNodes = this.markers.childNodes;
            this.hydrated = false;
        }
        const { values } = templateResult;
        for (const part of this.parts) part.update(values);
        if (this.hasRootNodeParts) this.refreshChildNodes();
    }

    /**
     * Re-reads the top level nodes between the markers. Parts at the root of the template insert and remove their
     * content there, so the list is only known after an update. Detached nodes have no siblings to walk, the last
     * known list is kept in that case.
     */
    refreshChildNodes() {
        const { startNode, endNode } = this.markers;
        if (startNode.parentNode) {
            this.childNodes = [startNode, ...getNodesBetweenComments(startNode, endNode), endNode];
        }
    }

    /**
     * Clones the template fragment and binds the parts to the markers in the clone.
     * @param {import('./TemplateResult.js').TemplateResult} templateResult
     */
    bindClone(templateResult) {
        const parsed = parseTemplate(templateResult.strings);
        const fragment = (parsed.fragment ??= convertStringToTemplate(parsed.clientHtml));
        const clone = globalThis.document.importNode(fragment, true);
        const startNode = clone.firstChild;
        startNode.__part = this; // add Part to comment node for debugging in the browser
        const parts = [];
        const endNode = walkPartMarkers(startNode, (node, index) => {
            this.createParts(parts, parsed.byMarker.get(index), node, templateResult.values, false);
        });
        this.parts = parts;
        this.strings = templateResult.strings;
        this.hasRootNodeParts = parsed.hasRootNodeParts;
        this.childNodes = [...clone.childNodes];
        this.markers = new PartMarkers(startNode, endNode, this.childNodes);
    }

    /**
     * Binds the parts to the markers of server rendered DOM. The start marker has to carry the hash of the literal
     * and every marker of the literal has to be there.
     * @param {Comment} startNode - the live template start marker
     * @param {import('./TemplateResult.js').TemplateResult} templateResult
     * @return {boolean} false if the markers do not match the template, nothing is bound in that case
     */
    bindLive(startNode, templateResult) {
        const parsed = parseTemplate(templateResult.strings);
        const parts = [];
        let found = 0;
        let endNode;
        if (templateHashOf(startNode.data) === parsed.hash) {
            try {
                endNode = walkPartMarkers(startNode, (node, index) => {
                    const descriptors = parsed.byMarker.get(index);
                    if (descriptors) {
                        found++;
                        this.createParts(parts, descriptors, node, templateResult.values, true);
                    }
                });
            } catch (error) {
                endNode = undefined;
            }
        }

        if (!endNode || found !== parsed.byMarker.size) {
            console.warn(
                'element-js: the server rendered markers do not match the template, rendering client side instead.',
                { template: parsed.clientHtml, startNode },
            );
            return false;
        }

        this.parts = parts;
        this.strings = templateResult.strings;
        this.hasRootNodeParts = parsed.hasRootNodeParts;
        this.markers = PartMarkers.createFromStartNode(startNode);
        this.childNodes = this.markers.childNodes;
        return true;
    }

    /**
     * Creates the parts that hang on one marker: a child node part on the marker itself, attribute, text and
     * directive parts on the element behind it.
     * @param {Part[]} parts - receives the parts, in descriptor order
     * @param {import('./parseTemplate.js').Descriptor[]} descriptors
     * @param {Comment} markerNode
     * @param {any[]} values - the first values, a directive part needs its directive class
     * @param {boolean} hydrate
     */
    createParts(parts, descriptors, markerNode, values, hydrate) {
        for (const descriptor of descriptors) {
            if (descriptor.kind === 'node') {
                parts.push(new ChildNodePart(markerNode, descriptor, hydrate));
                continue;
            }
            const element = markerNode.nextElementSibling;
            if (!element) {
                throw new Error(`TemplatePart: no element behind the marker ${markerNode.data}`);
            }
            switch (descriptor.kind) {
                case 'attribute':
                    parts.push(new AttributePart(element, descriptor));
                    break;
                case 'text':
                    parts.push(new TextContentPart(element, descriptor));
                    break;
                case 'directive':
                    parts.push(new DirectivePart(element, descriptor, values[descriptor.index]));
                    break;
                default:
                    throw new Error(`TemplatePart: cannot create a part for "${descriptor.kind}"`);
            }
        }
    }
}
