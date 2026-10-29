import { TEXT_NODE, convertStringToHTML, removeNodesUntil } from '../util/DOMHelper.js';
import { TemplateResult } from './TemplateResult.js';
import { TemplatePart } from './TemplatePart.js';
import { endMarkerOf, findTemplateStart } from './markers.js';

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

    /**
     * The items of an array value, one per position: the template part of a template item, the node of a node or
     * text item.
     * @type {Array<TemplatePart | Node>}
     */
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
            if (!hydrate) this.clear();
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
                        this.clear();
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
                    const serverStart = hydrate ? findTemplateStart(startNode.nextSibling, endNode) : undefined;
                    templatePart = new TemplatePart(value, serverStart);
                    templatePart.update(value);
                    if (!templatePart.hydrated) {
                        this.clear();
                        templatePart.insertBefore(endNode.parentNode, endNode);
                    }
                }
                value = templatePart;
                break;
            }
            case 'node':
                this.clear();
                endNode.parentNode.insertBefore(value, endNode);
                break;
            case 'html': {
                const nodes = [...convertStringToHTML(value).childNodes];
                if (!hydrate || !this.hasEqualNodes(nodes)) {
                    this.clear();
                    for (const node of nodes) endNode.parentNode.insertBefore(node, endNode);
                }
                break;
            }
            case 'array':
                this.writeArray(value, hydrate);
                break;
            default:
                if (hydrate) this.clear();
        }
        this.oldKind = kind;
        this.oldValue = value;
    }

    /**
     * Writes an array value in two passes. First every position gets its item: a template item keeps the template
     * part at its position when the literal is the same, a text item keeps the text node at its position, a node
     * item is the node. When hydrating, a template item binds to the next server rendered template instance, a text
     * item takes over the server rendered text node and a node item an equal node. Then a cursor brings the DOM in
     * line with the items: an item that is in place stays, nodes in its place that no item needs go away, anything
     * else is inserted or moved in front of the cursor. Nodes that stay in place are never touched, so focus and
     * element lifecycles survive.
     * @param {any[]} array
     * @param {boolean} hydrate
     */
    writeArray(array, hydrate) {
        const { startNode, endNode } = this;
        const parentNode = endNode.parentNode;
        const values = this.flatten(array);
        const oldItems = this.items;
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
                    const serverStart = findTemplateStart(server, endNode);
                    item = new TemplatePart(value, serverStart);
                    if (serverStart) server = (item.hydrated ? item.endNode : endMarkerOf(serverStart)).nextSibling;
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

        // the first nodes of the items tell a node that is needed further on from one that can go. The set is only
        // built when the DOM deviates from the items, a list whose items are all in place never pays for it
        let needed;
        let cursor = startNode.nextSibling;
        for (const item of items) {
            const isPart = item instanceof TemplatePart;
            const first = isPart ? item.startNode : item;
            if (first !== cursor) {
                needed ??= new Set(items.map((other) => (other instanceof TemplatePart ? other.startNode : other)));
                while (cursor !== endNode && !needed.has(cursor)) {
                    const next = cursor.nextSibling;
                    parentNode.removeChild(cursor);
                    cursor = next;
                }
            }
            if (first === cursor) {
                cursor = (isPart ? item.endNode : item).nextSibling;
            } else if (isPart) {
                item.insertBefore(parentNode, cursor);
            } else {
                parentNode.insertBefore(item, cursor);
            }
        }
        removeNodesUntil(cursor, endNode);
        this.items = items;
    }

    /**
     * The items of an array value as the server renders them: functions resolved, nested arrays flattened, null and
     * undefined dropped, the HTML of unsafeHTML() parsed into its nodes.
     * @param {any[]} array
     * @param {any[]} [values] - receives the items
     * @return {any[]}
     */
    flatten(array, values = []) {
        for (let value of array) {
            while (typeof value === 'function') value = value();
            if (Array.isArray(value)) {
                this.flatten(value, values);
            } else if (value?.__unsafeHTML) {
                values.push(...convertStringToHTML(value.string).childNodes);
            } else if (value != null) {
                values.push(value);
            }
        }
        return values;
    }

    /**
     * Removes everything between the markers.
     */
    clear() {
        removeNodesUntil(this.startNode.nextSibling, this.endNode);
    }

    /**
     * @param {Node[]} nodes
     * @return {boolean} whether the nodes between the markers equal the given nodes, one by one
     */
    hasEqualNodes(nodes) {
        let node = this.startNode.nextSibling;
        for (const other of nodes) {
            if (node === this.endNode || !node.isEqualNode(other)) return false;
            node = node.nextSibling;
        }
        return node === this.endNode;
    }
}
