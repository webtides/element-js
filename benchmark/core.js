/**
 * element-js rendering benchmark, measurement core.
 *
 * Browser only, no UI. Used by `index.html` (manual, via `npm run bench:ui`) and by `run.bench.js`
 * (headless via web-test-runner, `npm run bench`).
 *
 * Micro: cost of binding parts to a freshly cloned template fragment. Compares the current path based lookup
 * (`part.path.reduceRight(...)` in TemplatePart.parseValue) against TreeWalker based lookups. Every variant includes
 * the `importNode` clone, `clone-only` is the floor. All variants must resolve the same nodes, this is verified
 * before measuring and reported per variant.
 *
 * Macro: end-to-end `render()` of a js-framework-benchmark style table with the operation set of that benchmark,
 * plus `hydrate rows` (render into server markup produced by `toString()`). Two probes report whether updates after
 * a client render and after a hydration reach the DOM.
 *
 * Timing method (micro): each variant is warmed up for a fixed wall-clock time so the engine has finished tiering,
 * then sampled many times. Samples are a few milliseconds long: long enough for the coarsened `performance.now()`
 * resolution (0.1 ms without cross-origin isolation), short enough that garbage collection pauses hit single samples
 * and not the median. Variants rotate order per sample. `min` is the floor.
 */
import { html } from '../index.js';
import { render } from '../src/dom-parts/render.js';
import { TemplateResult } from '../src/dom-parts/TemplateResult.js';
import { convertStringToTemplate, getNodePath } from '../src/util/DOMHelper.js';

const SHOW_COMMENT = 128;
const SHOW_ELEMENT_AND_COMMENT = 129;
const SHOW_ALL = 0xffffffff;
const SLASH = 47;
const WARMUP_MS = 200;

export const defaults = {
    /** iterations per micro sample */
    iterations: 2000,
    /** micro samples per variant and shape */
    samples: 30,
    /** macro rounds */
    rounds: 9,
    /** macro rows */
    rows: 1000,
};

// ---------------------------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------------------------

export const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = sorted.length >> 1;
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const min = (values) => Math.min(...values);

const round = (value, digits = 2) => Number(value.toFixed(digits));

const countNodes = (root) => {
    const walker = document.createTreeWalker(root, SHOW_ALL);
    let count = 0;
    while (walker.nextNode()) count++;
    return count;
};

/** Rotates the variant order per sample so no variant always runs first. */
const rotate = (entries, offset) => entries.map((_, index) => entries[(index + offset) % entries.length]);

export const environment = () => ({
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
    date: new Date().toISOString(),
});

// ---------------------------------------------------------------------------------------------------------------
// micro: template shapes
// ---------------------------------------------------------------------------------------------------------------

// Plain string arrays work as TemplateStringsArray here. The library only joins them and uses them as cache key.
const wideStrings = [
    `<div class="wide">${'<span class="static">static</span>'.repeat(150)}<p id="`,
    `" class="`,
    `">`,
    `</p></div>`,
];

export const shapes = [
    {
        name: 'row',
        description: 'js-framework-benchmark <tr>, 4 parts',
        template: html`<tr id="${1}" class="${'danger'}">
            <td class="col-md-1">${1}</td>
            <td class="col-md-4"><a class="lbl">${'label'}</a></td>
            <td class="col-md-1">
                <a class="remove"><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></a>
            </td>
            <td class="col-md-6"></td>
        </tr>`,
    },
    {
        name: 'deep',
        description: '11 nested elements, 2 parts at the bottom',
        template: html`<div>
            <div>
                <div>
                    <div>
                        <div>
                            <div>
                                <div>
                                    <div>
                                        <div>
                                            <div>
                                                <p id="${'x'}">${'text'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`,
    },
    {
        name: 'wide',
        description: '150 static siblings before 3 parts, worst case for walkers',
        template: new TemplateResult(wideStrings, 'id', 'cls', 'text'),
    },
];

/**
 * Prepares everything a binding variant needs, once per shape. Mirrors what TemplatePart caches per `strings`:
 * the parsed fragment and the part descriptors with their paths. Additionally precomputes lit style node indices.
 */
export const prepare = (templateResult) => {
    const fragment = convertStringToTemplate(templateResult.templateString);
    const parts = templateResult.parseParts(fragment.childNodes);

    // lit style: index of each part marker in element+comment document order, in part order
    const partNodeIndex = [];
    const walker = document.createTreeWalker(fragment, SHOW_ELEMENT_AND_COMMENT);
    let node;
    let nodeIndex = 0;
    while ((node = walker.nextNode())) {
        if (node.nodeType === 8 && node.data.charCodeAt(0) !== SLASH && node.data !== 'template-part') {
            partNodeIndex.push(nodeIndex);
        }
        nodeIndex++;
    }

    return {
        fragment,
        parts,
        partNodeIndex,
        partCount: parts.length,
        nodeCount: countNodes(fragment),
        depth: Math.max(...parts.map((part) => part.path.length)),
    };
};

// ---------------------------------------------------------------------------------------------------------------
// micro: binding variants
// Each variant clones the fragment and resolves every part node. `out` is only set for the verification run.
// The returned number is a sink so that engines cannot drop the lookups.
// ---------------------------------------------------------------------------------------------------------------

export const variants = {
    'clone-only': ({ fragment }) => {
        const clone = document.importNode(fragment, true);
        return clone.childNodes.length;
    },

    'path reduceRight (current)': ({ fragment, parts }, out) => {
        const clone = document.importNode(fragment, true);
        // TemplatePart passes `this` with `this.childNodes = importedFragment.childNodes`
        const root = { childNodes: clone.childNodes };
        let sink = 0;
        for (let index = 0; index < parts.length; index++) {
            const node = parts[index].path.reduceRight(({ childNodes }, i) => childNodes[i], root);
            sink += node.nodeType;
            if (out) out.push(node);
        }
        return sink;
    },

    'walker comments, N from data': ({ fragment, parts }, out) => {
        const clone = document.importNode(fragment, true);
        const walker = document.createTreeWalker(clone, SHOW_COMMENT);
        const total = parts.length;
        let node;
        let found = 0;
        let sink = 0;
        while (found < total && (node = walker.nextNode())) {
            const data = node.data;
            if (data.charCodeAt(0) === SLASH || data === 'template-part') continue;
            // 'dom-part-' is 9 chars, parseInt stops at '?'
            const index = parseInt(data.slice(9), 10);
            sink += parts[index] ? node.nodeType : 0;
            found++;
            if (out) out.push(node);
        }
        return sink;
    },

    'walker comments, ordinal': ({ fragment, parts }, out) => {
        const clone = document.importNode(fragment, true);
        const walker = document.createTreeWalker(clone, SHOW_COMMENT);
        const total = parts.length;
        let node;
        let found = 0;
        let sink = 0;
        while (found < total && (node = walker.nextNode())) {
            const data = node.data;
            if (data.charCodeAt(0) === SLASH || data === 'template-part') continue;
            sink += parts[found] ? node.nodeType : 0;
            found++;
            if (out) out.push(node);
        }
        return sink;
    },

    'walker nodeIndex (lit)': ({ fragment, partNodeIndex }, out) => {
        const clone = document.importNode(fragment, true);
        const walker = document.createTreeWalker(clone, SHOW_ELEMENT_AND_COMMENT);
        const total = partNodeIndex.length;
        let node;
        let nodeIndex = 0;
        let found = 0;
        let sink = 0;
        while (found < total && (node = walker.nextNode())) {
            if (nodeIndex === partNodeIndex[found]) {
                sink += node.nodeType;
                found++;
                if (out) out.push(node);
            }
            nodeIndex++;
        }
        return sink;
    },
};

const signature = (nodes) => nodes.map((node) => getNodePath(node).join('.')).join('|');

/**
 * @param {{iterations: number, samples: number}} config
 * @param {(text: string) => void} [onProgress]
 */
export const runMicro = async ({ iterations, samples: sampleCount }, onProgress) => {
    const results = [];
    const entries = Object.entries(variants);

    for (const shape of shapes) {
        const prepared = prepare(shape.template);

        // verification: every binding variant must resolve the same nodes as the current implementation
        const reference = [];
        variants['path reduceRight (current)'](prepared, reference);
        const referenceSignature = signature(reference);
        const verified = {};
        for (const [name, fn] of entries) {
            if (name === 'clone-only') continue;
            const out = [];
            fn(prepared, out);
            verified[name] = out.length === prepared.partCount && signature(out) === referenceSignature;
        }

        // warmup: fixed wall-clock time per variant so that the engine finishes tiering before sampling
        for (const [, fn] of entries) {
            const until = performance.now() + WARMUP_MS;
            while (performance.now() < until) {
                for (let i = 0; i < 100; i++) fn(prepared, null);
            }
        }
        await tick();

        const samples = Object.fromEntries(entries.map(([name]) => [name, []]));
        let sink = 0;
        for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
            for (const [name, fn] of rotate(entries, sampleIndex)) {
                const start = performance.now();
                for (let i = 0; i < iterations; i++) sink += fn(prepared, null);
                const elapsed = performance.now() - start;
                samples[name].push((elapsed / iterations) * 1000); // µs per op
            }
            if (sampleIndex % 10 === 9) onProgress?.(`micro ${shape.name}: sample ${sampleIndex + 1}/${sampleCount}`);
            // yield so that garbage collection runs outside the timed sections
            await tick();
        }

        const floor = median(samples['clone-only']);
        const current = median(samples['path reduceRight (current)']) - floor;
        results.push({
            name: shape.name,
            description: shape.description,
            partCount: prepared.partCount,
            nodeCount: prepared.nodeCount,
            depth: prepared.depth,
            samples: sampleCount,
            iterationsPerSample: iterations,
            sink,
            variants: entries.map(([name]) => {
                const med = median(samples[name]);
                const overhead = med - floor;
                return {
                    name,
                    medianUs: round(med, 2),
                    minUs: round(min(samples[name]), 2),
                    bindingOverheadUs: name === 'clone-only' ? 0 : round(overhead, 2),
                    relativeToCurrent: name === 'clone-only' || current <= 0 ? null : round(overhead / current, 2),
                    verified: name === 'clone-only' ? null : verified[name],
                };
            }),
        });
    }

    return results;
};

// ---------------------------------------------------------------------------------------------------------------
// macro: js-framework-benchmark style table
// ---------------------------------------------------------------------------------------------------------------

const adjectives = ['pretty', 'large', 'big', 'small', 'tall', 'short', 'long', 'handsome', 'plain', 'quaint', 'clean'];
const colours = ['red', 'yellow', 'blue', 'green', 'pink', 'brown', 'purple', 'brown', 'white', 'black', 'orange'];
const nouns = ['table', 'chair', 'house', 'bbq', 'desk', 'car', 'pony', 'cookie', 'sandwich', 'burger', 'pizza'];

/** Deterministic PRNG (mulberry32) so that every run renders the same data. */
const createRandom = (seed) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

let nextId = 1;
const buildData = (count, random) => {
    const data = [];
    for (let i = 0; i < count; i++) {
        const pick = (list) => list[Math.floor(random() * list.length)];
        data.push({ id: nextId++, label: `${pick(adjectives)} ${pick(colours)} ${pick(nouns)}` });
    }
    return data;
};

const rowTemplate = (item, selected) =>
    html`<tr id="${item.id}" class="${selected === item.id ? 'danger' : ''}">
        <td class="col-md-1">${item.id}</td>
        <td class="col-md-4"><a class="lbl">${item.label}</a></td>
        <td class="col-md-1">
            <a class="remove"><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></a>
        </td>
        <td class="col-md-6"></td>
    </tr>`;

const tableTemplate = (data, selected) =>
    html`<table class="table">
        <tbody>
            ${data.map((item) => rowTemplate(item, selected))}
        </tbody>
    </table>`;

const measure = (fn) => {
    const start = performance.now();
    fn();
    return performance.now() - start;
};

/** Same operation set as js-framework-benchmark, the interactive version lives in examples/index.html. */
export const macroOperations = [
    'create rows',
    'replace all rows',
    'partial update',
    'select row',
    'swap rows',
    'remove row',
    'append rows',
    'clear rows',
    'create many rows',
    'hydrate rows',
];

/**
 * @param {{rows: number, rounds: number, host: Element}} config - `host` receives the containers while rendering
 * @param {(text: string) => void} [onProgress]
 */
export const runMacro = async ({ rows, rounds, host }, onProgress) => {
    const samples = Object.fromEntries(macroOperations.map((name) => [name, []]));
    let clientUpdatesReachDom = null;
    let hydratedUpdatesReachDom = null;
    const touchEvery10th = (data) =>
        data.map((item, index) => (index % 10 === 0 ? { ...item, label: `${item.label} !!!` } : item));

    for (let roundIndex = 0; roundIndex < rounds; roundIndex++) {
        const random = createRandom(42);
        nextId = 1;

        // fresh container per round, the renderer caches its TemplatePart per container
        const container = document.createElement('div');
        host.append(container);
        const draw = (data, selected) => measure(() => render(tableTemplate(data, selected), container));

        let data = buildData(rows, random);
        let selected = undefined;

        samples['create rows'].push(draw(data, selected));
        await tick();

        data = buildData(rows, random);
        samples['replace all rows'].push(draw(data, selected));
        await tick();

        data = touchEvery10th(data);
        samples['partial update'].push(draw(data, selected));
        clientUpdatesReachDom = container.querySelector('a.lbl').textContent.endsWith('!!!');
        await tick();

        selected = data[Math.floor(rows / 2)].id;
        samples['select row'].push(draw(data, selected));
        await tick();

        data = [...data];
        [data[1], data[data.length - 2]] = [data[data.length - 2], data[1]];
        samples['swap rows'].push(draw(data, selected));
        await tick();

        data = data.filter((_, index) => index !== Math.floor(rows / 2));
        samples['remove row'].push(draw(data, selected));
        await tick();

        data = data.concat(buildData(rows, random));
        samples['append rows'].push(draw(data, selected));
        await tick();

        data = [];
        samples['clear rows'].push(draw(data, selected));
        await tick();

        data = buildData(rows * 10, random);
        samples['create many rows'].push(draw(data, undefined));
        await tick();
        render(tableTemplate([], undefined), container);
        await tick();

        // hydration: server markup first, then the same template rendered into it
        const hydrated = document.createElement('div');
        host.append(hydrated);
        data = buildData(rows, random);
        hydrated.innerHTML = tableTemplate(data, undefined).toString();
        samples['hydrate rows'].push(measure(() => render(tableTemplate(data, undefined), hydrated)));
        // probe: does an update after hydration reach the DOM? Flips to true once #168 is fixed.
        render(tableTemplate(touchEvery10th(data), undefined), hydrated);
        hydratedUpdatesReachDom = hydrated.querySelector('a.lbl').textContent.endsWith('!!!');
        await tick();

        container.remove();
        hydrated.remove();
        onProgress?.(`macro: round ${roundIndex + 1}/${rounds}`);
        await tick(10);
    }

    return {
        rows,
        rounds,
        clientUpdatesReachDom,
        hydratedUpdatesReachDom,
        operations: macroOperations.map((name) => ({
            name,
            medianMs: round(median(samples[name]), 2),
            minMs: round(min(samples[name]), 2),
        })),
    };
};
