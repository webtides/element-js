/**
 * Formats benchmark results as Markdown.
 *
 *   node benchmark/report.mjs [head.json] [--base base.json] [--threshold 30]
 *
 * Defaults to benchmark/results/latest.json, which `benchmark/run.mjs` writes. With a base, every macro operation
 * gets a delta column and deviations from the threshold on are flagged. The micro part, when present, goes into a
 * collapsed section: its strategies are implemented in the harness, so they describe binding strategies, not the
 * release under test.
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

const probeLabels = {
    clientUpdatesReachDom: 'client updates reach DOM',
    hydratedUpdatesReachDom: 'hydrated updates reach DOM',
};

const yesNo = (value) => (value === null || value === undefined ? 'n/a' : value ? 'yes' : '**no**');

const describeCommit = (results) => {
    const git = results.git ?? {};
    if (!git.sha) return 'unknown commit';
    return `${git.ref ? `\`${git.ref}\` ` : ''}${git.sha}${git.dirty ? ' (uncommitted changes)' : ''}`;
};

const shortStrategy = {
    'clone-only': 'clone only',
    'path reduceRight': 'path',
    'walker comments (N from data)': 'walker N',
    'walker comments (ordinal)': 'walker ordinal',
    'walker nodeIndex (lit style)': 'walker lit',
};

/**
 * @param {object} head - the results of the working tree
 * @param {{base?: object, threshold?: number, title?: string}} [options]
 * @return {string}
 */
export const formatMarkdown = (head, { base, threshold = 30, title = 'Renderer benchmark' } = {}) => {
    const out = [];
    const env = head.environment ?? {};
    const browser = /(Chrome|Firefox|Safari)\/[\d.]+/.exec(env.userAgent ?? '')?.[0] ?? 'unknown browser';
    const machine = `${browser}${env.headless ? ' headless' : ''}, ${env.hardwareConcurrency ?? '?'} cores, ${(
        env.date ?? ''
    ).slice(0, 10)}`;

    out.push(`### ${title}`);
    out.push('');
    out.push(`${describeCommit(head)}${base ? ` vs base ${describeCommit(base)}` : ''} · ${machine}`);
    if (head.hiddenDuringRun) {
        out.push('');
        out.push('> Tab was hidden during the run, medians may be inflated. Compare median against min.');
    }

    const macro = head.macro;
    if (macro) {
        const baseOperations = new Map((base?.macro?.operations ?? []).map((v) => [v.name, v]));
        const rows = [];
        const deviations = [];
        const percent = (value, reference) => ((value - reference) / reference) * 100;
        const format = (delta) => `${delta > 0 ? '+' : ''}${delta.toFixed(0)}%`;
        for (const v of macro.operations) {
            if (!base) {
                rows.push([v.name, v.medianMs, v.minMs]);
                continue;
            }
            const baseValue = baseOperations.get(v.name);
            if (!baseValue) {
                rows.push([v.name, 'n/a', v.medianMs, '', '']);
                continue;
            }
            const deltaMedian = percent(v.medianMs, baseValue.medianMs);
            const deltaMin = percent(v.minMs, baseValue.minMs);
            // a single slow round moves the median, not the min. Only a change that shows in both is reported.
            const flagged =
                Math.abs(deltaMedian) >= threshold &&
                Math.abs(deltaMin) >= threshold &&
                Math.sign(deltaMedian) === Math.sign(deltaMin);
            const flag = deltaMedian > 0 ? '⚠️' : '✅';
            if (flagged) deviations.push(`${v.name} ${format(deltaMedian)} ${flag}`);
            rows.push([
                v.name,
                baseValue.medianMs,
                v.medianMs,
                flagged ? `**${format(deltaMedian)}** ${flag}` : format(deltaMedian),
                flagged ? `**${format(deltaMin)}**` : format(deltaMin),
            ]);
        }

        out.push('');
        if (base) {
            out.push(
                deviations.length === 0
                    ? `**No operation deviates ${threshold}% or more from base.**`
                    : `**${deviations.length} of ${
                          macro.operations.length
                      } operations deviate ${threshold}% or more from base:** ${deviations.join(', ')}`,
            );
            out.push('');
        }

        const probes = Object.entries(probeLabels).map(([key, label]) => {
            const baseProbe = base?.macro?.[key];
            const changed = base && baseProbe !== macro[key];
            return `${label}: ${yesNo(macro[key])}${changed ? ` (base: ${yesNo(baseProbe)})` : ''}`;
        });
        out.push(`Probes: ${probes.join(' · ')}`);
        out.push('');

        const subject = `operation, \`render()\` with ${macro.rows} rows, median of ${macro.rounds}`;
        out.push(
            base
                ? table([subject, 'base ms', 'head ms', 'Δ median', 'Δ min'], rows)
                : table([subject, 'median ms', 'min ms'], rows),
        );
    }

    if (head.micro) {
        const strategyNames = head.micro[0]?.variants.map((v) => v.name) ?? [];
        const rows = head.micro.map((shape) => [
            `${shape.name} (${shape.nodeCount} nodes, ${shape.partCount} parts, depth ${shape.depth})`,
            ...shape.variants.map((v) => (v.name === 'clone-only' ? v.medianUs : v.bindingOverheadUs)),
        ]);
        const mismatches = head.micro.flatMap((shape) =>
            shape.variants.filter((v) => v.verified === false).map((v) => `${shape.name}: ${v.name}`),
        );
        out.push('');
        out.push('<details>');
        out.push('<summary>Micro: part binding strategies, µs per clone</summary>');
        out.push('');
        out.push(
            'Implemented in the harness, identical on every commit. `clone only` is the floor, every other column is the binding overhead on top of it (median).',
        );
        out.push('');
        out.push(table(['shape', ...strategyNames.map((name) => shortStrategy[name] ?? name)], rows));
        out.push('');
        out.push(
            mismatches.length === 0
                ? 'All strategies resolved the same nodes.'
                : `**Strategies that resolved different nodes:** ${mismatches.join(', ')}`,
        );
        out.push('');
        out.push('</details>');
    }

    out.push('');
    out.push(
        base
            ? `_Base and head ran on the same machine right after each other. An operation is flagged when median and min both move ${threshold}% or more in the same direction, a single slow round only moves the median._`
            : '_Absolute numbers depend on the machine. Compare runs from the same machine only, `--base <ref>` does that for you._',
    );
    out.push('');
    return out.join('\n');
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
    const here = dirname(fileURLToPath(import.meta.url));
    const args = process.argv.slice(2);
    const option = (name) => {
        const index = args.indexOf(name);
        return index === -1 ? undefined : args[index + 1];
    };
    const positional = args.filter(
        (arg, index) => !arg.startsWith('--') && !['--base', '--threshold'].includes(args[index - 1]),
    );
    const headFile = positional[0] ?? join(here, 'results', 'latest.json');
    const head = JSON.parse(await readFile(headFile, 'utf8'));
    const baseFile = option('--base');
    const base = baseFile ? JSON.parse(await readFile(baseFile, 'utf8')) : undefined;
    const markdown = formatMarkdown(head, { base, threshold: Number(option('--threshold') ?? 30) });
    await writeFile(join(dirname(headFile), 'latest.md'), markdown);
    process.stdout.write(markdown);
}
