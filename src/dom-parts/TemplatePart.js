import { convertStringToTemplate } from '../util/DOMHelper.js';
import { AttributePart } from './AttributePart.js';
import { ChildNodePart } from './ChildNodePart.js';
import { DirectivePart } from './DirectivePart.js';
import { TextContentPart } from './TextContentPart.js';
import { isTemplateEnd, isTemplateStart, partIndexOf, templateHashOf } from './markers.js';
import { parseTemplate } from './parseTemplate.js';

const SHOW_COMMENT = 128; // NodeFilter.SHOW_COMMENT

/**
 * @param {Element} element
 * @param {import('./parseTemplate.js').Descriptor} descriptor
 * @param {any[]} values - the first values, a directive part takes its directive class from them
 * @return {{update: (values: any[]) => void}}
 */
const createElementPart = (element, descriptor, values) => {
    switch (descriptor.kind) {
        case 'attribute':
            return new AttributePart(element, descriptor);
        case 'text':
            return new TextContentPart(element, descriptor);
        default:
            return new DirectivePart(element, descriptor, values[descriptor.index]);
    }
};

/**
 * One rendered instance of a template literal: the nodes from its template start marker to its end marker, and the
 * parts bound to the markers in between. An instance binds either to a fresh clone of the template fragment, which
 * stays in the fragment until insertBefore() puts it into the DOM, or, when hydrating, to the markers of server
 * rendered DOM. Construction only binds, values flow through update().
 */
export class TemplatePart {
    /** @type {Comment} the template start marker */
    startNode;

    /** @type {Comment} the template end marker */
    endNode;

    /** @type {TemplateStringsArray} */
    strings;

    /** @type {{update: (values: any[]) => void}[]} one per descriptor of the template, in document order */
    parts = [];

    /** @type {boolean} the parts are bound to server rendered DOM */
    hydrated = false;

    /** @type {DocumentFragment|undefined} the clone, until it is inserted */
    fragment;

    /**
     * @param {import('./TemplateResult.js').TemplateResult} templateResult
     * @param {Comment} [startNode] - the template start marker of server rendered DOM to hydrate
     */
    constructor(templateResult, startNode) {
        const { strings, values } = templateResult;
        const parsed = parseTemplate(strings);
        this.strings = strings;
        if (startNode) {
            this.hydrated = this.bindLive(startNode, parsed, values);
            if (this.hydrated) return;
        }
        const fragment = (parsed.fragment ??= convertStringToTemplate(parsed.clientHtml));
        this.fragment = globalThis.document.importNode(fragment, true);
        this.bind(this.fragment.firstChild, parsed, values, false);
    }

    /**
     * @param {import('./TemplateResult.js').TemplateResult} templateResult
     */
    update(templateResult) {
        const { values } = templateResult;
        for (const part of this.parts) part.update(values);
    }

    /**
     * Puts the instance into the DOM: the fresh clone, or the nodes from the start to the end marker of an instance
     * that is in the DOM already.
     * @param {Node} parentNode
     * @param {Node|null} refNode
     */
    insertBefore(parentNode, refNode) {
        if (this.fragment) {
            parentNode.insertBefore(this.fragment, refNode);
            this.fragment = undefined;
            return;
        }
        const { endNode } = this;
        let node = this.startNode;
        for (;;) {
            const next = node.nextSibling;
            parentNode.insertBefore(node, refNode);
            if (node === endNode) break;
            node = next;
        }
    }

    /**
     * Binds the parts to the markers of server rendered DOM. The start marker has to carry the hash of the literal
     * and the markers have to be those of the literal.
     * @param {Comment} startNode
     * @param {import('./parseTemplate.js').ParsedTemplate} parsed
     * @param {any[]} values
     * @return {boolean} false when the markers do not match, nothing is bound then
     */
    bindLive(startNode, parsed, values) {
        let reason = 'the start marker carries the hash of another template';
        if (templateHashOf(startNode.data) === parsed.hash) {
            try {
                this.bind(startNode, parsed, values, true);
                return true;
            } catch (error) {
                reason = error.message;
                this.parts = [];
            }
        }
        console.warn(
            `element-js: the server rendered markers do not match the template, rendering client side instead: ${reason}`,
            {
                template: parsed.clientHtml,
                startNode,
            },
        );
        return false;
    }

    /**
     * Walks the comment markers from the template start marker to its end marker and creates the parts: a child node
     * part on its marker, attribute, text and directive parts on the element behind their marker. Markers and
     * descriptors are both in document order and the descriptors of one marker follow each other, so both are
     * consumed in step. Nested template instances are skipped. The walk sees the same markers in a fresh clone and in
     * server rendered DOM, where the values sit between the markers but are no comments.
     * @param {Comment} startNode
     * @param {import('./parseTemplate.js').ParsedTemplate} parsed
     * @param {any[]} values
     * @param {boolean} hydrate
     */
    bind(startNode, parsed, values, hydrate) {
        const { descriptors } = parsed;
        const walker = globalThis.document.createTreeWalker(startNode.parentNode, SHOW_COMMENT);
        walker.currentNode = startNode;
        startNode.__part = this; // for debugging in the browser
        this.startNode = startNode;
        let depth = 1;
        let next = 0;
        let node;
        while ((node = walker.nextNode())) {
            const { data } = node;
            if (isTemplateStart(data)) {
                depth++;
                continue;
            }
            if (isTemplateEnd(data)) {
                if (--depth === 0) break;
                continue;
            }
            const index = depth === 1 ? partIndexOf(data) : -1;
            if (index === -1) continue;
            const descriptor = descriptors[next];
            if (descriptor?.marker !== index) {
                throw new Error(`the marker <!--${index}--> has no binding in the template`);
            }
            if (descriptor.kind === 'node') {
                this.parts.push(new ChildNodePart(node, descriptor, hydrate));
                next++;
                continue;
            }
            const element = node.nextElementSibling;
            if (!element) throw new Error(`there is no element behind the marker <!--${index}-->`);
            while (descriptors[next]?.marker === index) {
                this.parts.push(createElementPart(element, descriptors[next++], values));
            }
        }
        if (!node) throw new Error('the template end marker is missing');
        if (next !== descriptors.length) {
            throw new Error(`${descriptors.length - next} bindings of the template have no marker`);
        }
        this.endNode = node;
    }
}
