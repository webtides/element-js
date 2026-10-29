import { COMMENT_NODE, TEXT_NODE, convertStringToHTML } from '../util/DOMHelper.js';
import { TemplateResult } from './TemplateResult.js';
import { TemplatePart } from './TemplatePart.js';
import { endMarkerDataOf, isTemplateEnd, isTemplateStart } from './markers.js';

/**
 * Removes every node between the two markers, walking forward from the start marker. Not a Range: the browser keeps
 * every Range alive and updates it on each DOM mutation, one per part makes every later insertion pay for all of
 * them.
 * @param {Comment} startNode
 * @param {Comment} endNode
 */
const removeNodesBetween = (startNode, endNode) => {
    const parentNode = endNode.parentNode;
    let node = startNode.nextSibling;
    while (node !== endNode) {
        const next = node.nextSibling;
        parentNode.removeChild(node);
        node = next;
    }
};

/** @param {Node} node */
const isTemplateStartNode = (node) => node.nodeType === COMMENT_NODE && isTemplateStart(node.data);

/**
 * The end marker of a start marker, among its siblings. Nested template instances in between are skipped, their
 * markers carry their own indices: the element marker <!--0--> of a nested template is not the end of the part
 * <!--0--> around it.
 * @param {Comment} startNode - a part start marker or a template start marker
 * @return {Comment}
 */
const endMarkerOf = (startNode) => {
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

/**
 * @param {Comment} startNode
 * @param {Comment} endNode
 * @return {Comment|undefined} the first template start marker between the markers
 */
const nestedTemplateStart = (startNode, endNode) => {
    for (let node = startNode.nextSibling; node !== endNode; node = node.nextSibling) {
        if (isTemplateStartNode(node)) return node;
    }
    return undefined;
};

/**
 * @param {Comment} startNode
 * @param {Comment} endNode
 * @param {Node[]} nodes
 * @return {boolean} whether the nodes between the markers equal the given nodes, one by one
 */
const sameNodes = (startNode, endNode, nodes) => {
    let node = startNode.nextSibling;
    for (const other of nodes) {
        if (node === endNode || !node.isEqualNode(other)) return false;
        node = node.nextSibling;
    }
    return node === endNode;
};

/**
 * @typedef {TemplatePart | Node} Item - what stands at one position of an array value: the template part of a
 * template item, the node of a node or text item
 */

/** @param {Item} item @return {Node} */
const firstNodeOf = (item) => (item.nodeType ? item : item.startNode);

/** @param {Item} item @return {Node} */
const lastNodeOf = (item) => (item.nodeType ? item : item.endNode);

/**
 * Removes what starts at a node: a template instance up to its end marker, any other node by itself.
 * @param {Node} node
 * @return {Node} the node behind it
 */
const removeAt = (node) => {
    const parentNode = node.parentNode;
    const end = isTemplateStartNode(node) ? endMarkerOf(node) : node;
    const next = end.nextSibling;
    let current = node;
    for (;;) {
        const following = current.nextSibling;
        parentNode.removeChild(current);
        if (current === end) break;
        current = following;
    }
    return next;
};

/**
 * An interpolation between elements: a text, a node, a template, HTML from unsafeHTML(), an array of those, or
 * nothing. The value is rendered between the start and the end marker of the part.
 */
export class ChildNodePart {
    /** @type {Comment} */
    startNode;

    /** @type {Comment} */
    endNode;

    /** @type {import('./parseTemplate.js').NodeDescriptor} */
    descriptor;

    /**
     * True until the first update of a part that is bound to server rendered DOM: nested templates bind to the
     * server rendered markers between the part's markers and nodes that are in place already stay untouched.
     * @type {boolean}
     */
    hydrating;

    /** @type {'empty' | 'text' | 'template' | 'node' | 'html' | 'array'} the kind of what is between the markers */
    oldKind = 'empty';

    /** @type {any} the text, the template part, the node or the HTML string that is between the markers */
    oldValue = undefined;

    /** @type {Text|undefined} the text node of a text value, reused across updates */
    textNode;

    /** @type {Item[]} the items of an array value, one per position */
    items = [];

    /**
     * @param {Comment} startNode - the start marker
     * @param {import('./parseTemplate.js').NodeDescriptor} descriptor
     * @param {boolean} [hydrate] - the start marker is server rendered DOM
     */
    constructor(startNode, descriptor, hydrate = false) {
        startNode.__part = this; // for debugging in the browser
        this.startNode = startNode;
        this.endNode = endMarkerOf(startNode);
        this.descriptor = descriptor;
        this.hydrating = hydrate;
    }

    /**
     * @param {any[]} values
     */
    update(values) {
        this.setValue(values[this.descriptor.index]);
    }

    /**
     * @param {TemplateResult | any[] | Node | any} value
     */
    setValue(value) {
        const hydrate = this.hydrating;
        this.hydrating = false;

        let resolved = value;
        while (typeof resolved === 'function') resolved = resolved();

        if (resolved?.__unsafeHTML) {
            this.write('html', resolved.string, hydrate);
        } else if (resolved instanceof TemplateResult) {
            this.write('template', resolved, hydrate);
        } else if (Array.isArray(resolved)) {
            this.write('array', resolved, hydrate);
        } else if (resolved?.nodeType) {
            this.write('node', resolved, hydrate);
        } else if (resolved == null) {
            this.write('empty', undefined, hydrate);
        } else {
            this.write('text', String(resolved), hydrate);
        }
    }

    /**
     * Writes a value between the markers. What a value of another kind left there goes away first. When hydrating,
     * the server rendered nodes that fit the value are taken over instead: the text node of a text, the template
     * instance of a template, equal nodes of HTML.
     * @param {'empty' | 'text' | 'template' | 'node' | 'html' | 'array'} kind
     * @param {any} value - the text, the template result, the node, the HTML string or the array
     * @param {boolean} hydrate
     */
    write(kind, value, hydrate) {
        // the same text, node or HTML string again has nothing to do. An array may be the same instance with other
        // items, a template result is new on every render, both are always written
        if (kind === this.oldKind && value === this.oldValue && kind !== 'array') return;
        const { startNode, endNode } = this;
        if (kind !== this.oldKind) {
            if (!hydrate) removeNodesBetween(startNode, endNode);
            this.textNode = undefined;
            this.items = [];
        }
        switch (kind) {
            case 'text':
                if (!this.textNode) {
                    const serverNode = startNode.nextSibling;
                    if (hydrate && serverNode.nodeType === TEXT_NODE && serverNode.nextSibling === endNode) {
                        this.textNode = serverNode;
                    } else {
                        removeNodesBetween(startNode, endNode);
                        this.textNode = endNode.parentNode.insertBefore(document.createTextNode(''), endNode);
                    }
                }
                if (this.textNode.data !== value) this.textNode.data = value;
                break;
            case 'template': {
                // the same literal updates its instance, another literal gets a fresh instance in place of the old one
                let templatePart = this.oldKind === 'template' ? this.oldValue : undefined;
                if (templatePart?.strings === value.strings) {
                    templatePart.update(value);
                } else {
                    templatePart = new TemplatePart(
                        value,
                        hydrate ? nestedTemplateStart(startNode, endNode) : undefined,
                    );
                    templatePart.update(value);
                    if (!templatePart.hydrated) {
                        removeNodesBetween(startNode, endNode);
                        templatePart.insertBefore(endNode.parentNode, endNode);
                    }
                }
                value = templatePart;
                break;
            }
            case 'node':
                removeNodesBetween(startNode, endNode);
                endNode.parentNode.insertBefore(value, endNode);
                break;
            case 'html': {
                const nodes = [...convertStringToHTML(value).childNodes];
                if (!hydrate || !sameNodes(startNode, endNode, nodes)) {
                    removeNodesBetween(startNode, endNode);
                    for (const node of nodes) endNode.parentNode.insertBefore(node, endNode);
                }
                break;
            }
            case 'array':
                this.writeArray(value, hydrate);
                break;
            default:
                if (hydrate) removeNodesBetween(startNode, endNode);
        }
        this.oldKind = kind;
        this.oldValue = value;
    }

    /**
     * Writes an array value. The items are the flat list the server renders as well: functions resolved, nested
     * arrays flattened, null and undefined dropped, HTML of unsafeHTML() parsed into its nodes. Every position
     * gets its item first: a template item keeps the template part at its position when the literal is the same,
     * a text item keeps the text node at its position, a node item is the node. When hydrating, a template item
     * binds to the next server rendered template instance, a text item takes over the text node and a node item
     * an equal node at the server rendered position. Then the DOM is brought in line with the items: an item that
     * is in place stays, what is in its place and not needed any more goes away, anything else is inserted or
     * moved in front of the item that follows. Nodes that stay in place are never touched, so focus and element
     * lifecycles survive.
     * @param {any[]} array
     * @param {boolean} hydrate
     */
    writeArray(array, hydrate) {
        const values = [];
        const visit = (item) => {
            let value = item;
            while (typeof value === 'function') value = value();
            if (Array.isArray(value)) {
                for (const inner of value) visit(inner);
            } else if (value?.__unsafeHTML) {
                values.push(...convertStringToHTML(value.string).childNodes);
            } else if (value != null) {
                values.push(value);
            }
        };
        for (const item of array) visit(item);

        const { startNode, endNode } = this;
        const parentNode = endNode.parentNode;
        const oldItems = this.items;
        /** @type {Item[]} */
        const items = [];
        // the next server rendered node that no item has taken over yet
        let server = hydrate ? startNode.nextSibling : endNode;
        for (let position = 0; position < values.length; position++) {
            const value = values[position];
            const old = oldItems[position];
            let item;
            if (value instanceof TemplateResult) {
                if (old instanceof TemplatePart && old.strings === value.strings) {
                    item = old;
                } else {
                    let start;
                    for (let node = server; node !== endNode && !start; node = node.nextSibling) {
                        if (isTemplateStartNode(node)) start = node;
                    }
                    item = new TemplatePart(value, start);
                    if (start) server = (item.hydrated ? item.endNode : endMarkerOf(start)).nextSibling;
                }
                item.update(value);
            } else if (value.nodeType) {
                item = value;
                if (server !== endNode && server.isEqualNode(value)) {
                    item = server;
                    server = server.nextSibling;
                }
            } else {
                const text = String(value);
                if (old?.nodeType === TEXT_NODE) {
                    item = old;
                } else if (server.nodeType === TEXT_NODE) {
                    item = server;
                    server = server.nextSibling;
                } else {
                    item = document.createTextNode(text);
                }
                if (item.data !== text) item.data = text;
            }
            items.push(item);
        }

        // the first nodes of the items tell a stale node from one that is needed further on. Only built when the
        // DOM deviates from the items, a list whose items are all in place never pays for it
        let keep;
        let cursor = startNode.nextSibling;
        for (const item of items) {
            const first = firstNodeOf(item);
            if (first !== cursor) {
                keep ??= new Set(items.map(firstNodeOf));
                while (cursor !== endNode && !keep.has(cursor)) cursor = removeAt(cursor);
            }
            if (first === cursor) {
                cursor = lastNodeOf(item).nextSibling;
            } else if (item.nodeType) {
                parentNode.insertBefore(item, cursor);
            } else {
                item.insertBefore(parentNode, cursor);
            }
        }
        while (cursor !== endNode) cursor = removeAt(cursor);
        this.items = items;
    }
}
