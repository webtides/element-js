import { COMMENT_NODE, convertStringToTemplate } from '../util/DOMHelper.js';
import { Part } from './Part.js';
import { TemplateResult } from './TemplateResult.js';
import { AttributePart } from './AttributePart.js';
import { ChildNodePart, processNodePart } from './ChildNodePart.js';
import { NodePart } from './NodePart.js';
import { RawTextNodePart } from './RawTextNodePart.js';

/** @type {Map<TemplateStringsArray, Part[]>} */
const partsCache = new WeakMap();

/** @type {Map<TemplateStringsArray, DocumentFragment>} */
const fragmentsCache = new WeakMap();

export class TemplatePart extends Part {
    /** @type {Part[]} */
    parts = [];

    /** @type {TemplateStringsArray} */
    strings = undefined;

    /** @type {Node[]} */
    childNodes = [];

    /**
     * @param {Node} startNode - the start comment marker node
     * @param {TemplateResult} value
     */
    constructor(startNode, value) {
        if (startNode && startNode?.nodeType !== COMMENT_NODE) {
            throw new Error('TemplatePart: startNode is not a comment node');
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

        this.parseValue(value);

        if (!serverSideRendered) {
            // TODO: this is causing double diffing because of the this.parseValue() before, ChildNode parts will be constructed + processed
            this.updateParts(value.values);
        }

        endNode = this.childNodes[this.childNodes.length - 1];

        if (endNode) {
            this.processor = processNodePart(endNode, this);
        }
    }

    /**
     * @param {TemplateResult} value
     */
    update(value) {
        const shouldUpdateDOM = this.parseValue(value);
        if (shouldUpdateDOM) {
            this.processor?.(this);
        }
        this.updateParts(value.values);
    }

    /**
     * @param {any[]} values
     */
    updateParts(values) {
        for (let index = 0; index < values.length; index++) {
            this.parts[index]?.update(values[index]);
        }
    }

    /**
     * @param {TemplateResult} templateResult
     * @return {boolean} whether the part needs to be updated in the DOM
     */
    parseValue(templateResult) {
        if (this.strings !== templateResult.strings) {
            let fragment = fragmentsCache.get(templateResult.strings);
            if (!fragment) {
                fragment = this.parseFragment(templateResult);
                fragmentsCache.set(templateResult.strings, fragment);
            }
            const importedFragment = globalThis.document?.importNode(fragment, true);
            this.childNodes = importedFragment.childNodes;

            let parts = partsCache.get(templateResult.strings);
            if (!parts) {
                parts = templateResult.parseParts(this.childNodes);
                partsCache.set(templateResult.strings, parts);
            }

            this.parts = parts
                .map((part) => {
                    // We currently need the path because the fragment will be cloned via importNode and therefore the node will be a different one
                    part.node = part.path.reduceRight(({ childNodes }, i) => childNodes[i], this);
                    return part;
                })
                .map((part, index) => {
                    if (part.type === 'node') {
                        return new ChildNodePart(part.node, templateResult.values[index]);
                    }
                    if (part.type === 'attribute') {
                        return new AttributePart(part.node, part.name, part.initialValue);
                    }
                    if (part.type === 'raw-text-node') {
                        return new RawTextNodePart(part.node, part.initialValue);
                    }
                    if (part.type === 'directive') {
                        return new NodePart(part.node, templateResult.values[index]);
                    }
                    throw `cannot map part: ${part}`;
                });
            this.strings = templateResult.strings;
            this.childNodes = [...this.childNodes];
            return true;
        }
        return false;
    }

    /**
     * @param {TemplateResult} templateResult
     * @return {DocumentFragment}
     */
    parseFragment(templateResult) {
        const templateString = templateResult.templateString;
        return convertStringToTemplate(templateString);
    }
}
