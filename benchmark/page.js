/**
 * UI glue for the manual benchmark page (`npm run bench:ui`). Measurement lives in core.js.
 *
 * Query params: iterations (per micro sample), samples (micro samples per variant), rounds (macro), rows (macro),
 * delay (ms before an autorun starts), autorun (run everything on load).
 */
import { defaults, environment, runMacro, runMicro, tick } from './core.js';

const params = new URLSearchParams(location.search);

const numberParam = (name, fallback) => {
    const value = Number(params.get(name));
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

const state = { micro: null, macro: null, hiddenDuringRun: false };

// Background tabs get lower priority and extra garbage collection. Allocation heavy micro loops then show medians
// far above their minimums while the macro numbers stay put. Record it so results can be judged.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) state.hiddenDuringRun = true;
});

const renderMicroTable = (results) => {
    let out = '';
    for (const shape of results) {
        out += `<h3>${shape.name} <small>${shape.description}, ${shape.nodeCount} nodes, ${shape.partCount} parts, max path length ${shape.depth}</small></h3>`;
        out += `<table><thead><tr><th>variant</th><th>median µs/op</th><th>min µs/op</th><th>binding overhead µs</th><th>× current</th><th>verified</th></tr></thead><tbody>`;
        for (const v of shape.variants) {
            const verified =
                v.verified === null
                    ? ''
                    : v.verified
                      ? '<span class="ok">ok</span>'
                      : '<span class="fail">MISMATCH</span>';
            const relative = v.relativeToCurrent === null ? '' : `${v.relativeToCurrent}×`;
            out += `<tr><td>${v.name}</td><td>${v.medianUs}</td><td>${v.minUs}</td><td>${v.bindingOverheadUs}</td><td>${relative}</td><td>${verified}</td></tr>`;
        }
        out += `</tbody></table>`;
    }
    return out;
};

const renderMacroTable = (results) => {
    const flag = (value) => (value ? '<span class="ok">yes</span>' : '<span class="fail">no</span>');
    let out = `<p>${results.rows} rows, ${results.rounds} rounds. Client updates reach DOM: ${flag(
        results.clientUpdatesReachDom,
    )}. Hydrated updates reach DOM: ${flag(results.hydratedUpdatesReachDom)}.</p>`;
    out += `<table><thead><tr><th>operation</th><th>median ms</th><th>min ms</th></tr></thead><tbody>`;
    for (const v of results.operations) {
        out += `<tr><td>${v.name}</td><td>${v.medianMs}</td><td>${v.minMs}</td></tr>`;
    }
    out += `</tbody></table>`;
    return out;
};

const publish = () => {
    const results = {
        environment: environment(),
        hiddenDuringRun: state.hiddenDuringRun,
        micro: state.micro,
        macro: state.macro,
    };
    window.__benchResults = results;
    document.getElementById('json').textContent = JSON.stringify(results, null, 2);
    document.getElementById('warning').textContent = state.hiddenDuringRun
        ? 'Tab was hidden during the run. Micro medians can be inflated by background garbage collection, compare median against min or rerun with the tab visible.'
        : '';
    console.log('BENCH_RESULTS', JSON.stringify(results));
};

const setStatus = (text) => {
    document.getElementById('status').textContent = text;
};

const readConfig = () => ({
    iterations: Number(document.getElementById('iterations').value) || defaults.iterations,
    samples: Number(document.getElementById('samples').value) || defaults.samples,
    rounds: Number(document.getElementById('rounds').value) || defaults.rounds,
    rows: Number(document.getElementById('rows').value) || defaults.rows,
    host: document.getElementById('table-host'),
});

const withButtonsDisabled = async (fn) => {
    const buttons = [...document.querySelectorAll('button')];
    buttons.forEach((button) => (button.disabled = true));
    state.hiddenDuringRun = document.hidden;
    try {
        await fn();
    } finally {
        buttons.forEach((button) => (button.disabled = false));
    }
};

const micro = () =>
    withButtonsDisabled(async () => {
        setStatus('running micro…');
        state.micro = await runMicro(readConfig(), setStatus);
        document.getElementById('micro-results').innerHTML = renderMicroTable(state.micro);
        publish();
        setStatus('micro done');
    });

const macro = () =>
    withButtonsDisabled(async () => {
        setStatus('running macro…');
        state.macro = await runMacro(readConfig(), setStatus);
        document.getElementById('macro-results').innerHTML = renderMacroTable(state.macro);
        publish();
        setStatus('macro done');
    });

const all = async () => {
    await micro();
    await macro();
    setStatus('done');
    document.body.dataset.benchDone = 'true';
};

document.getElementById('iterations').value = numberParam('iterations', defaults.iterations);
document.getElementById('samples').value = numberParam('samples', defaults.samples);
document.getElementById('rounds').value = numberParam('rounds', defaults.rounds);
document.getElementById('rows').value = numberParam('rows', defaults.rows);
document.getElementById('run-micro').addEventListener('click', micro);
document.getElementById('run-macro').addEventListener('click', macro);
document.getElementById('run-all').addEventListener('click', all);

if (params.has('autorun')) {
    // Let the page settle after load before the first allocation heavy loop starts.
    const delay = numberParam('delay', 2000);
    setStatus(`autorun in ${delay} ms…`);
    tick(delay).then(all);
}
