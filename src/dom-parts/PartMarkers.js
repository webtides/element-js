import { COMMENT_NODE } from '../util/DOMHelper.js';
import { endMarkerDataOf, isTemplateEnd, isTemplateStart, partIndexOf } from './markers.js';

const SHOW_COMMENT = 128; // NodeFilter.SHOW_COMMENT

/**
 * Walks the comment markers of one template instance in document order, starting at its template start marker,
 * and calls back for every part marker of the instance with the marker node and the index it carries. End markers
 * and everything inside nested templates (between their own template markers) are skipped.
 *
 * Works on a freshly cloned template fragment as well as on live, server rendered DOM: there the values sit between
 * the markers, but they are not comments, so the walk sees the same sequence of markers in both cases.
 *
 * @param {Comment} startNode - the template start marker of the instance
 * @param {(node: Comment, index: number) => void} [onPartMarker]
 * @return {Comment} the matching template end marker
 */
export const walkPartMarkers = (startNode, onPartMarker) => {
    const walker = globalThis.document.createTreeWalker(startNode.parentNode, SHOW_COMMENT);
    walker.currentNode = startNode;
    let depth = 1;
    let node;
    while ((node = walker.nextNode())) {
        const data = node.data;
        if (isTemplateStart(data)) {
            depth++;
        } else if (isTemplateEnd(data)) {
            depth--;
            if (depth === 0) return node;
        } else if (depth === 1) {
            const index = partIndexOf(data);
            if (index !== -1) onPartMarker?.(node, index);
        }
    }
    throw new Error('PartMarkers: missing template end marker');
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
     * The start markers of the template instances directly between the markers, in document order. Templates
     * nested inside those are not included.
     * @return {Comment[]}
     */
    findNestedStartNodes() {
        const startNodes = [];
        let depth = 0;
        for (const node of this.childNodes.slice(1, -1)) {
            if (node.nodeType !== COMMENT_NODE) continue;
            if (isTemplateStart(node.data)) {
                if (depth === 0) startNodes.push(node);
                depth++;
            } else if (isTemplateEnd(node.data)) {
                depth--;
            }
        }
        return startNodes;
    }

    /**
     * @return {Comment|undefined} the first nested template start marker, or undefined if there is none
     */
    findNestedStartNode() {
        return this.findNestedStartNodes()[0];
    }

    /**
     * Creates markers from a start marker by walking its siblings to the matching end marker. The markers of
     * template instances in between are skipped, they carry their own indices: the element marker <!--0--> of a
     * nested template is not the end of the part <!--0--> around it.
     * @param {Comment} startNode - a template start marker or a part start marker
     * @return {PartMarkers}
     */
    static createFromStartNode(startNode) {
        const data = startNode.data;
        const isTemplate = isTemplateStart(data);
        const closing = endMarkerDataOf(data);
        const childNodes = [startNode];
        let depth = isTemplate ? 1 : 0;
        let node = startNode.nextSibling;
        while (node) {
            childNodes.push(node);
            if (node.nodeType === COMMENT_NODE) {
                const other = node.data;
                if (isTemplateStart(other)) {
                    depth++;
                } else if (isTemplateEnd(other)) {
                    depth--;
                    if (depth === 0 && isTemplate) break;
                } else if (depth === 0 && other === closing) {
                    break;
                }
            }
            node = node.nextSibling;
        }
        if (!node) {
            throw new Error(`PartMarkers: missing end marker for "${data}"`);
        }
        return new PartMarkers(startNode, node, childNodes);
    }
}
