export class PartMarkers {
    /** @type {Comment} */
    startNode;

    /** @type {Comment} */
    endNode;

    /** @type {Node[]} */
    childNodes = [];

    /** @type {boolean} */
    serverSideRendered = false;

    /**
     * @param {Comment} start
     * @param {Comment} end
     * @param {Node[]} childNodes
     * @return {void}
     */
    constructor(start, end, childNodes) {
        this.startNode = start;
        this.endNode = end;
        this.childNodes = childNodes;

        // if not SSRed, childNodes will only ever have two comment nodes, the start and the end marker
        if (childNodes.length > 2) {
            this.serverSideRendered = true;
        }
    }

    /**
     * Creates a new instance of PartMarkers from the given start node.
     * @param {Comment} startNode - The starting comment node that marks the beginning of the section.
     * @return {PartMarkers} A new instance of the PartMarkers class encapsulating the start and end nodes.
     */
    static createFromStartNode(startNode) {
        let endNode;

        const placeholder = startNode.data;
        const childNodes = [startNode];
        let childNode = startNode.nextSibling;
        while (childNode && childNode.data !== `/${placeholder}`) {
            childNodes.push(childNode);
            childNode = childNode.nextSibling;
        }

        endNode = childNode;
        childNodes.push(endNode);

        return new PartMarkers(startNode, endNode, childNodes);
    }
}
