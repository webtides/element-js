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
