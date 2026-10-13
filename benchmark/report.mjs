/**
 * Formats benchmark results as Markdown.
 *
 *   node benchmark/report.mjs [results.json]   prints the report, writes <results dir>/latest.md next to the JSON
 *
 * Defaults to benchmark/results/latest.json, which `npm run bench` writes.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const table = (header, rows) => {
    const lines = [
        `| ${header.join(' | ')} |`,
        `| ${header.map((_, index) => (index === 0 ? '---' : '---:')).join(' | ')} |`,
        ...rows.map((row) => `| ${row.join(' | ')} |`),
    ];
    return lines.join('\n');
};

const flag = (value) => (value === null || value === undefined ? 'n/a' : value ? 'yes' : '**no**');

/**
 * @param {object} results - the JSON written by the benchmark run
 * @param {{title?: string}} [options]
 * @return {string}
 */
export const formatMarkdown = (results, { title = 'Renderer benchmark' } = {}) => {
    const out = [];
    const env = results.environment ?? {};
    const browser = /(Chrome|Firefox|Safari)\/[\d.]+/.exec(env.userAgent ?? '')?.[0] ?? 'unknown browser';
    out.push(`### ${title}`);
    out.push('');
    out.push(
        `${browser}, ${env.hardwareConcurrency ?? '?'} cores, ${env.headless ? 'headless' : 'page'}, ${env.date ?? ''}`,
    );
    if (results.hiddenDuringRun) {
        out.push('');
        out.push('> Tab was hidden during the run, micro medians may be inflated. Compare median against min.');
    }

    if (results.macro) {
        const macro = results.macro;
        out.push('');
        out.push(`**Macro** — \`render()\`, ${macro.rows} rows, ${macro.rounds} rounds, ms (median / min)`);
        out.push('');
        out.push(
            `Probes: client updates reach DOM: ${flag(macro.clientUpdatesReachDom)}, hydrated updates reach DOM: ${flag(
                macro.hydratedUpdatesReachDom,
            )}`,
        );
        out.push('');
        out.push(
            table(
                ['operation', 'median ms', 'min ms'],
                macro.operations.map((v) => [v.name, v.medianMs, v.minMs]),
            ),
        );
    }

    if (results.micro) {
        out.push('');
        out.push('**Micro** — part binding per clone, µs (binding overhead = median − clone-only median)');
        for (const shape of results.micro) {
            out.push('');
            out.push(
                `_${shape.name}_: ${shape.description}, ${shape.nodeCount} nodes, ${shape.partCount} parts, max path length ${shape.depth}, ${shape.samples} × ${shape.iterationsPerSample} iterations`,
            );
            out.push('');
            out.push(
                table(
                    ['variant', 'median µs', 'min µs', 'overhead µs', '× current', 'verified'],
                    shape.variants.map((v) => [
                        v.name,
                        v.medianUs,
                        v.minUs,
                        v.bindingOverheadUs,
                        v.relativeToCurrent === null ? '' : `${v.relativeToCurrent}×`,
                        v.verified === null ? '' : v.verified ? 'ok' : '**MISMATCH**',
                    ]),
                ),
            );
        }
    }

    out.push('');
    out.push(
        '_Absolute numbers depend on the machine. Compare runs from the same machine only, the probes and the relative micro columns travel._',
    );
    out.push('');
    return out.join('\n');
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
    const here = dirname(fileURLToPath(import.meta.url));
    const file = process.argv[2] ?? join(here, 'results', 'latest.json');
    const results = JSON.parse(await readFile(file, 'utf8'));
    const markdown = formatMarkdown(results);
    await writeFile(join(dirname(file), 'latest.md'), markdown);
    process.stdout.write(markdown);
}
