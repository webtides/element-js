import { COMMENT_NODE, convertStringToTemplate } from '../util/DOMHelper.js';
import { Part } from './Part.js';
import { TemplateResult } from './TemplateResult.js';
import { AttributePart } from './AttributePart.js';
import { ChildNodePart, getNodesBetweenComments, replaceNodesBetweenComments } from './ChildNodePart.js';
import { NodePart } from './NodePart.js';
import { RawTextNodePart } from './RawTextNodePart.js';
import { PartMarkers } from './PartMarkers.js';

/** @type {WeakMap<TemplateStringsArray, Part[]>} */
const partsCache = new WeakMap();

/** @type {WeakMap<TemplateStringsArray, DocumentFragment>} */
const fragmentsCache = new WeakMap();

export class TemplatePart extends Part {
    /** @type {PartMarkers|undefined} */
    markers;

    /** @type {Part[]} */
    parts = [];

    /** @type {TemplateStringsArray} */
    strings = undefined;

    /** @type {Node[]} */
    childNodes = [];
    // TODO: there is childNodes here and also in this.markers now...

    /**
     * @param {Node|undefined} startNode - the start comment marker node
     * @param {TemplateResult} value
     */
    constructor(startNode, value) {
        if (startNode && startNode?.nodeType !== COMMENT_NODE) {
            throw new Error('TemplatePart: startNode is not a comment node');
        }

        super();

        if (startNode) {
            startNode.__part = this; // add Part to comment node for debugging in the browser
            this.markers = PartMarkers.createFromStartNode(startNode);
            this.childNodes = this.markers.childNodes;
        }

        this.parseValue(value);

        if (!this.markers?.serverSideRendered) {
            // TODO: this is causing double diffing because of the this.parseValue() before, ChildNode parts will be constructed + processed
            // TODO: I think that maybe ChildNode Parts work, but Other Parts like Attributes are not set initially otherwise...
            this.updateParts(value.values);
        }

        // TODO: this is somewhat strange that we are creating this twice...
        this.markers = PartMarkers.createFromStartNode(this.childNodes[0]);
    }

    /**
     * @param {TemplateResult} templateResult
     */
    update(templateResult) {
        const shouldUpdateDOM = this.strings !== templateResult.strings;
        if (shouldUpdateDOM) {
            this.parseValue(templateResult);
            // TODO: this is a strange way of replacing the childnodes...
            const endNode = this.childNodes[this.childNodes.length - 1];
            // INFO: this is similar to TemplateResult#237
            replaceNodesBetweenComments(this.markers?.endNode, getNodesBetweenComments(endNode));
        }
        this.updateParts(templateResult.values);
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
     */
    parseValue(templateResult) {
        let fragment = fragmentsCache.get(templateResult.strings);
        if (!fragment) {
            fragment = convertStringToTemplate(templateResult.templateString);
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
    }
}
