/**
 * Plays hydration through in the browser. The "server" is `toString()` of a template, its markup is inserted into
 * a container as innerHTML, then `render()` of the same template hydrates it. A MutationObserver on the container
 * logs every change, so a step that must not touch the DOM shows up as a step without mutations.
 */
import { TemplateElement, defineElement, html } from '../../index.js';
import { render } from '../../src/dom-parts/render.js';

/* ---------- elements used by the scenarios ---------- */

/** Counts its own connects and disconnects and shows them, a move in the DOM becomes visible this way. */
class LifecycleElement extends HTMLElement {
    connects = 0;
    disconnects = 0;

    connectedCallback() {
        this.connects++;
        this.textContent = `connected ${this.connects}×, disconnected ${this.disconnects}×`;
    }

    disconnectedCallback() {
        this.disconnects++;
    }
}
customElements.define('lifecycle-element', LifecycleElement);

const counterTemplate = (count, increment) =>
    html`<button type="button" class="btn" @click="${increment}">clicked ${count} times</button>`;

/** A TemplateElement whose light DOM the server rendered. It hydrates on its own when it connects. */
class HydrationCounter extends TemplateElement {
    properties() {
        return { count: 0 };
    }

    template() {
        return counterTemplate(this.count, () => this.count++);
    }
}
defineElement('hydration-counter', HydrationCounter);

/* ---------- scenarios ---------- */

/**
 * @typedef {object} Scenario
 * @property {string} name
 * @property {string} hint - what to look for
 * @property {() => object} state - the initial state, server and client start from it
 * @property {(state: object) => TemplateResult} template - the client template
 * @property {(state: object) => TemplateResult} [serverTemplate] - what the server rendered, if it differs
 * @property {Object<string, (state: object) => object>} [actions] - label → next state
 * @property {boolean} [element] - the markup is wrapped in <hydration-counter>, which hydrates on connect
 */

/** @type {Scenario[]} */
const scenarios = [
    {
        name: 'Text and attribute',
        hint: 'Compare the hydrate step with the update: hydrating binds the parts to the nodes that are there, the update changes one attribute and one text node.',
        state: () => ({ count: 0 }),
        template: ({ count }) => html`<p data-count="${count}">count: ${count}</p>`,
        actions: { 'count + 1': ({ count }) => ({ count: count + 1 }) },
    },
    {
        name: 'List',
        hint: 'The server rendered items stay. A new item is cloned in, a removed one is dropped. Items are bound by index, so reversing updates the texts in place.',
        state: () => ({ items: ['a', 'b', 'c'] }),
        template: ({ items }) =>
            html`<ul class="list-disc ml-6">
                ${items.map((item) => html`<li>${item}</li>`)}
            </ul>`,
        actions: {
            'add item': ({ items }) => ({ items: [...items, String.fromCharCode(97 + items.length)] }),
            'remove last': ({ items }) => ({ items: items.slice(0, -1) }),
            reverse: ({ items }) => ({ items: [...items].reverse() }),
        },
    },
    {
        name: 'Text in front of an input',
        hint: 'Click into the input, then change the text. The input is not touched and keeps the focus.',
        state: () => ({ text: 'before' }),
        template: ({ text }) =>
            html`<label>${[text, html`<input class="border px-1 ml-2" placeholder="focus me" />`]}</label>`,
        actions: { 'change text': ({ text }) => ({ text: text === 'before' ? 'after' : 'before' }) },
    },
    {
        name: 'Custom element in a mixed array',
        hint: 'The element counts its connects. Changing the text in front of it must not disconnect it.',
        state: () => ({ text: 'before' }),
        template: ({ text }) => html`<div>${[text, html`<lifecycle-element class="ml-2"></lifecycle-element>`]}</div>`,
        actions: { 'change text': ({ text }) => ({ text: text === 'before' ? 'after' : 'before' }) },
    },
    {
        name: 'Nested template on and off',
        hint: 'The server rendered nothing for the nested template. The client clones it in and removes it again.',
        state: () => ({ show: false }),
        template: ({ show }) => html`<div>${show ? html`<b>on</b>` : null}</div>`,
        actions: { toggle: ({ show }) => ({ show: !show }) },
    },
    {
        name: 'Markers that do not match',
        hint: 'The server rendered a different template. Hydrating warns and renders client side instead.',
        state: () => ({ value: 'a' }),
        serverTemplate: ({ value }) => html`<p class="${value}">server</p>`,
        template: ({ value }) => html`<p id="${value}">client</p>`,
        actions: { 'change value': ({ value }) => ({ value: value === 'a' ? 'b' : 'a' }) },
    },
    {
        name: 'Element hydrates itself',
        hint: 'A TemplateElement with server rendered light DOM hydrates when it connects, so step 2 happens on insert. Click the button in the DOM: only the text node changes.',
        state: () => ({ count: 0 }),
        template: ({ count }) => counterTemplate(count, () => {}),
        element: true,
    },
];

/* ---------- page ---------- */

const $ = (id) => document.getElementById(id);
const dom = $('dom');
/** @type {Scenario} */
let scenario;
let state;
/** @type {HTMLElement} the container of the current run, a fresh one per inserted markup */
let container;

const describe = (node) => {
    if (!node) return 'none';
    if (node.nodeType === Node.TEXT_NODE) return `"${node.data.trim() || '⏎'}"`;
    if (node.nodeType === Node.COMMENT_NODE) return `<!--${node.data}-->`;
    return `<${node.localName}>`;
};

const logEntry = (text, kind = '') => {
    const item = document.createElement('li');
    item.textContent = text;
    item.className = kind;
    $('log').append(item);
};

new MutationObserver((records) => {
    for (const record of records) {
        if (record.type === 'childList') {
            const added = [...record.addedNodes].map((node) => `+${describe(node)}`);
            const removed = [...record.removedNodes].map((node) => `−${describe(node)}`);
            logEntry(`childList in ${describe(record.target)}: ${[...added, ...removed].join(' ')}`);
        } else if (record.type === 'attributes') {
            const value = record.target.getAttribute(record.attributeName);
            logEntry(
                `attribute ${record.attributeName} on ${describe(record.target)}: "${record.oldValue}" → "${value}"`,
            );
        } else {
            logEntry(`characterData: "${record.oldValue}" → "${record.target.data}"`);
        }
    }
}).observe(dom, {
    childList: true,
    attributes: true,
    characterData: true,
    subtree: true,
    attributeOldValue: true,
    characterDataOldValue: true,
});

// warnings of the renderer, for example markers that do not match, belong into the log
const warn = console.warn;
console.warn = (...args) => {
    logEntry(`console.warn: ${args[0]}`, 'warn');
    warn.apply(console, args);
};

const showFocus = () => {
    const active = document.activeElement;
    $('focus').textContent = `document.activeElement: ${dom.contains(active) ? describe(active) : 'outside the demo'}`;
};
dom.addEventListener('focusin', showFocus);
dom.addEventListener('focusout', () => setTimeout(showFocus));

const serverMarkup = () => {
    const markup = (scenario.serverTemplate ?? scenario.template)(state).toString();
    return scenario.element ? `<hydration-counter>${markup}</hydration-counter>` : markup;
};

const renderClient = (label) => {
    logEntry(`step: ${label}`, 'step');
    render(scenario.template(state), container);
    showFocus();
};

const renderActions = (enabled) => {
    const actions = $('actions');
    actions.replaceChildren();
    for (const [label, apply] of Object.entries(scenario.actions ?? {})) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-secondary';
        button.textContent = label;
        button.disabled = !enabled;
        // a click must not take the focus away from the demo, the focus scenarios depend on it
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', () => {
            state = apply(state);
            renderClient(`${label}, render() again`);
        });
        actions.append(button);
    }
};

const select = (next) => {
    scenario = next;
    state = scenario.state();
    container = undefined;
    dom.replaceChildren();
    $('log').replaceChildren();
    $('hint').textContent = scenario.hint;
    $('server-markup').textContent = serverMarkup().replace(/></g, '>\n<');
    $('hydrate').disabled = true;
    $('hydrate').textContent = scenario.element ? '2. hydrates on connect' : '2. hydrate';
    for (const button of $('scenarios').children) {
        button.classList.toggle('btn-active', button.textContent === scenario.name);
    }
    renderActions(false);
    showFocus();
};

$('render-server').addEventListener('click', () => {
    logEntry('step: server markup inserted as innerHTML', 'step');
    container = document.createElement('div');
    container.innerHTML = serverMarkup();
    dom.replaceChildren(container);
    $('hydrate').disabled = scenario.element === true;
    renderActions(false);
});

$('hydrate').addEventListener('click', () => {
    renderClient('hydrate, render() into the server markup');
    $('hydrate').disabled = true;
    renderActions(true);
});

$('clear-log').addEventListener('click', () => $('log').replaceChildren());

for (const item of scenarios) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = item.name;
    button.addEventListener('click', () => select(item));
    $('scenarios').append(button);
}
select(scenarios[0]);
