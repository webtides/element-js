/* An Element node like <p> or <div> */
export const ELEMENT_NODE = 1;
/* An Attribute of an Element */
export const ATTRIBUTE_NODE = 2;
/* The actual Text inside an Element or Attr */
export const TEXT_NODE = 3;
/* A Comment node, such as <!-- … --> */
export const COMMENT_NODE = 8;
/* A Document Fragment, a document without a parent */
export const DOCUMENT_FRAGMENT_NODE = 11;

/**
 * Get a list of all parent nodes up the DOM tree
 * @param {Node} domNode
 * @returns {Node[]}
 */
export function getAllParentNodes(domNode) {
    let node = domNode.parentElement;
    let parents = [];
    while (node) {
        parents.unshift(node); // adds node to the beginning of parents
        node = node.parentElement;
    }

    return parents;
}

/**
 * Gets the parent/root element of a shadow root or the global document body if not in shadow root.
 * https://stackoverflow.com/questions/27453617/how-can-i-tell-if-an-element-is-in-a-shadow-dom
 * @param {Node} element
 * @returns {ShadowRoot | HTMLElement}
 */
export function getShadowParentOrBody(element) {
    if (element instanceof ShadowRoot) {
        return element;
    }

    while (element.parentNode && (element = element.parentNode)) {
        if (element instanceof ShadowRoot) {
            return element;
        }
    }
    return document.body;
}

/**
 * Get the closest/first parent node that is a custom element
 * @param {Node} domNode
 * @returns {Node}
 */
export function getClosestParentCustomElementNode(domNode) {
    const customElementParents = getAllParentNodes(domNode).filter((node) => {
        return node.localName && node.localName.indexOf('-') !== -1;
    });

    return customElementParents.pop();
}

/**
 * Get all custom element children of a DOM node
 * @param {Node} domNode
 * @param {{prototype: HTMLElement, new()}} instanceOfFilter
 * @return {Node[]}
 */
export function getAllElementChildren(domNode, instanceOfFilter = HTMLElement) {
    const nodeIterator = document.createNodeIterator(domNode, NodeFilter.SHOW_ELEMENT, (node) =>
        node.nodeName.includes('-') && node instanceof instanceOfFilter
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT,
    );
    const customElements = [];
    let currentNode;
    while ((currentNode = nodeIterator.nextNode())) {
        customElements.push(currentNode);
    }
    return customElements;
}

/**
 * Get all custom element children of a DOM node, including children inside the node's shadow root.
 *
 * @param {Node} domNode - The root node to start the traversal from.
 * @param {{prototype: HTMLElement, new(): HTMLElement}} [instanceOfFilter=HTMLElement] - Constructor used to filter matching custom elements.
 * @return {Set<HTMLElement>} A set of matching custom element descendants.
 */
export function getAllComposedElementChildren(domNode, instanceOfFilter = HTMLElement) {
    return new Set([
        ...getAllElementChildren(domNode, instanceOfFilter),
        ...(domNode.shadowRoot ? getAllElementChildren(domNode.shadowRoot, instanceOfFilter) : []),
    ]);
}

/**
 * Checks whether two nodes are of the same node type
 * @param {Node} nodeA
 * @param {Node} nodeB
 * @returns {boolean}
 */
export function isOfSameNodeType(nodeA, nodeB) {
    if (!nodeA || !nodeA.localName) return false;
    if (!nodeB || !nodeB.localName) return false;
    return nodeA.localName === nodeB.localName;
}

/**
 * Checks if adopting style sheets is supported in browser
 * @returns {boolean}
 */
export const supportsAdoptingStyleSheets = () => {
    return 'adoptedStyleSheets' in Document.prototype && 'replace' in CSSStyleSheet.prototype;
};

/**
 * Parses the given string as HTML template and returns a real DOM element
 * @param {string} template
 * @returns {HTMLElement}
 */
export const convertStringToHTML = (template) => {
    const parser = new DOMParser();
    const document = parser.parseFromString(template.toString(), 'text/html');
    return document.body;
};

/**
 * Parses the given string and returns a DocumentFragment which contains the DOM subtree
 * representing the <template> element's template contents.
 * @param {string} string
 * @return {DocumentFragment}
 */
export const convertStringToTemplate = (string) => {
    const template = globalThis.document?.createElement('template');
    template.innerHTML = string;
    return template.content;
};

/**
 * Removes a node and its following siblings up to the end node, the end node stays. Walks forward, not a Range: the
 * browser keeps every Range alive and updates it on each DOM mutation, one per part makes every later insertion pay
 * for all of them.
 * @param {Node} node
 * @param {Node} endNode - a following sibling of the node, or the node itself to remove nothing
 */
export const removeNodesUntil = (node, endNode) => {
    const parentNode = endNode.parentNode;
    let current = node;
    while (current !== endNode) {
        const next = current.nextSibling;
        parentNode.removeChild(current);
        current = next;
    }
};

/**
 * Encodes a html string
 * @param {string} html
 * @returns {string}
 */
export function encodeHTML(html) {
    return `${html}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/\r\n/g, '\n')
        .replace(/[\r\n]/g, '\n');
}
