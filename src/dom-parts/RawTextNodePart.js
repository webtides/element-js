import { Part } from './Part.js';

/** @type {Map<Element, RawTextNodePart>} */
const rawTextNodePartsCache = new WeakMap();

/**
 * For updating a node that can only be updated via node.textContent
 * The nodes are: script | style | textarea | title
 */
export class RawTextNodePart extends Part {
    /** @type {Node} */
    node = undefined;

    interpolations = 1;
    values = [];
    currentValueIndex = 0;
    initialValue = undefined;

    /**
     * @param {Node} node
     * @param {string} initialValue
     */
    constructor(node, initialValue) {
        // If we have multiple raw text node parts for the same node, it means we have multiple
        // interpolations inside that node. Instead of creating a new part, we will return the same
        // as before and let it defer the update until the last interpolation gets updated
        const rawTextNodePart = rawTextNodePartsCache.get(node.nextElementSibling);
        if (rawTextNodePart) {
            rawTextNodePart.interpolations++;
            node.__part = rawTextNodePart; // add Part to comment node for debugging in the browser
            return rawTextNodePart;
        }

        super();
        this.initialValue = initialValue;
        node.__part = this; // add Part to comment node for debugging in the browser
        this.node = node.nextElementSibling;
        rawTextNodePartsCache.set(node.nextElementSibling, this);
    }

    /**
     * @param {string} value
     */
    update(value) {
        // If we only have one sole interpolation, we can just apply the update
        if (this.interpolations === 1) {
            this.node.textContent = value;
            return;
        }

        // Instead of applying the update immediately, we check if the part has multiple interpolations
        // and store the values for each interpolation in a list
        this.values[this.currentValueIndex++] = value;

        // Only the last call to update (for the last interpolation) will actually trigger the update
        // on the DOM processor. Here we can reset everything before the next round of updates
        if (this.interpolations === this.currentValueIndex) {
            this.currentValueIndex = 0;
            let replaceIndex = 0;
            // Note: this will coarse the values into strings, but it's probably ok since we are writing to raw text (only) nodes?!
            this.node.textContent = this.initialValue.replace(/\x03/g, () => this.values[replaceIndex++]);
        }
    }
}
