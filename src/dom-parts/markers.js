/**
 * The comment markers that a rendered template carries. They are the only thing hydration needs: where a part sits
 * and whether the server rendered the same template. The meaning of a part comes from the template literal, see
 * parseTemplate().
 *
 *   <!--t:a3f9c1-->      start of a template instance, with the hash of its literal
 *   <!--/t-->            end of a template instance
 *   <!--4-->…<!--/4-->   a child node part, the index of its first value in the literal
 *   <!--1--><div …>      the element behind the marker has attribute, text or directive parts, the index of the
 *                        first one. One marker per element, however many parts it has
 */

import { COMMENT_NODE } from '../util/DOMHelper.js';

const TEMPLATE_PREFIX = 't:';
const TEMPLATE_END = '/t';
const DIGITS = /^\d+$/;

/** @param {string} hash */
export const templateStartMarker = (hash) => `<!--${TEMPLATE_PREFIX}${hash}-->`;
export const templateEndMarker = `<!--${TEMPLATE_END}-->`;
/** @param {number} index */
export const partStartMarker = (index) => `<!--${index}-->`;
/** @param {number} index */
export const partEndMarker = (index) => `<!--/${index}-->`;

/** @param {string} data - the data of a comment node */
export const isTemplateStart = (data) => data.startsWith(TEMPLATE_PREFIX);
/** @param {string} data */
export const isTemplateEnd = (data) => data === TEMPLATE_END;
/** @param {string} data @return {string} the hash of a template start marker */
export const templateHashOf = (data) => data.slice(TEMPLATE_PREFIX.length);
/** @param {string} data @return {number} the index of a part start marker, -1 for any other comment */
export const partIndexOf = (data) => (DIGITS.test(data) ? parseInt(data, 10) : -1);
/**
 * @param {string} data - the data of a start marker
 * @return {string} the data of its end marker
 */
export const endMarkerDataOf = (data) => (isTemplateStart(data) ? TEMPLATE_END : `/${data}`);

/** @param {Node} node @return {boolean} whether the node is a template start marker */
export const isTemplateStartNode = (node) => node.nodeType === COMMENT_NODE && isTemplateStart(node.data);

/**
 * The first template start marker among a node and its following siblings, up to the end node.
 * @param {Node | null} node
 * @param {Node | null} [endNode]
 * @return {Comment | undefined}
 */
export const findTemplateStart = (node, endNode = null) => {
    for (let current = node; current && current !== endNode; current = current.nextSibling) {
        if (isTemplateStartNode(current)) return current;
    }
    return undefined;
};

/**
 * The end marker of a start marker, among its following siblings. Nested template instances in between are skipped,
 * their markers carry their own indices: the element marker <!--0--> of a nested template is not the end of the part
 * <!--0--> around it.
 * @param {Comment} startNode - a part start marker or a template start marker
 * @return {Comment}
 */
export const endMarkerOf = (startNode) => {
    const closing = endMarkerDataOf(startNode.data);
    let depth = 0;
    for (let node = startNode.nextSibling; node; node = node.nextSibling) {
        if (node.nodeType !== COMMENT_NODE) continue;
        const { data } = node;
        if (isTemplateStart(data)) {
            depth++;
        } else if (depth > 0) {
            if (isTemplateEnd(data)) depth--;
        } else if (data === closing) {
            return node;
        }
    }
    throw new Error(`the end marker of <!--${startNode.data}--> is missing`);
};
