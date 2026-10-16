import { COMMENT_NODE } from '../util/DOMHelper.js';

const SHOW_COMMENT = 128; // NodeFilter.SHOW_COMMENT
const SLASH = 47; // '/'
const PART_MARKER_PREFIX = 'dom-part-';
const TEMPLATE_MARKER = 'template-part';

/**
 * Walks the comment markers of one template instance in document order, starting at its `<!--template-part-->`
 * comment, and calls back for every top level part marker with the marker node and the index of its part. Closing
 * markers and everything inside nested templates (between their own template-part comments) are skipped.
 *
 * Works on a freshly cloned template fragment as well as on live, server rendered DOM: there the values sit between
 * the markers, but they are not comments, so the walk sees the same sequence of markers in both cases.
 *
 * @param {Comment} startNode - the `<!--template-part-->` comment of the instance
 * @param {(node: Comment, index: number) => void} [onPartMarker]
 * @return {Comment} the matching `<!--/template-part-->` comment
 */
export const walkPartMarkers = (startNode, onPartMarker) => {
    const walker = globalThis.document.createTreeWalker(startNode.parentNode, SHOW_COMMENT);
    walker.currentNode = startNode;
    let depth = 1;
    let node;
    while ((node = walker.nextNode())) {
        const data = node.data;
        if (data === TEMPLATE_MARKER) {
            depth++;
        } else if (data === `/${TEMPLATE_MARKER}`) {
            depth--;
            if (depth === 0) return node;
        } else if (depth === 1 && data.charCodeAt(0) !== SLASH && data.startsWith(PART_MARKER_PREFIX)) {
            // 'dom-part-12?type=attribute&…' → 12, parseInt stops at the '?'
            onPartMarker?.(node, parseInt(data.slice(PART_MARKER_PREFIX.length), 10));
        }
    }
    throw new Error('PartMarkers: missing closing template-part marker');
};

export class PartMarkers {
    /** @type {Comment} */
    startNode;

    /** @type {Comment} */
    endNode;

    /** @type {Node[]} all sibling nodes from the start to the end marker, both included */
    childNodes = [];

    /**
     * @param {Comment} start
     * @param {Comment} end
     * @param {Node[]} childNodes
     */
    constructor(start, end, childNodes) {
        this.startNode = start;
        this.endNode = end;
        this.childNodes = childNodes;
    }

    /**
     * The start comments of the nested parts directly between the markers, in document order. Markers inside those
     * nested parts are not included.
     * @param {string} partType - the marker name to search for. Defaults to 'template-part'.
     * @return {Comment[]}
     */
    findNestedStartNodes(partType = TEMPLATE_MARKER) {
        const closing = `/${partType}`;
        const startNodes = [];
        let depth = 0;
        for (const node of this.childNodes.slice(1, -1)) {
            if (node.nodeType !== COMMENT_NODE) continue;
            if (node.data === partType) {
                if (depth === 0) startNodes.push(node);
                depth++;
            } else if (node.data === closing) {
                depth--;
            }
        }
        return startNodes;
    }

    /**
     * @param {string} partType - the marker name to search for. Defaults to 'template-part'.
     * @return {Comment|undefined} the first nested start comment, or undefined if there is none
     */
    findNestedStartNode(partType = TEMPLATE_MARKER) {
        return this.findNestedStartNodes(partType)[0];
    }

    /**
     * Creates markers from a start comment by walking its siblings to the matching end comment. Nested markers with
     * the same name, for example a nested template at the root of a template, are skipped.
     * @param {Comment} startNode - the start comment that marks the beginning of the section
     * @return {PartMarkers}
     */
    static createFromStartNode(startNode) {
        const placeholder = startNode.data;
        const closing = `/${placeholder}`;
        const childNodes = [startNode];
        let depth = 1;
        let node = startNode.nextSibling;
        while (node) {
            childNodes.push(node);
            if (node.nodeType === COMMENT_NODE) {
                if (node.data === placeholder) {
                    depth++;
                } else if (node.data === closing) {
                    depth--;
                    if (depth === 0) break;
                }
            }
            node = node.nextSibling;
        }
        if (!node) {
            throw new Error(`PartMarkers: missing closing marker for "${placeholder}"`);
        }
        return new PartMarkers(startNode, node, childNodes);
    }
}
