/**
 * Runs the benchmark headless and prints the report.
 *
 *   node benchmark/run.mjs                      measures the working tree
 *   node benchmark/run.mjs --base main          also measures `main` and reports the deltas
 *   node benchmark/run.mjs --micro              includes the micro benchmark (part binding strategies)
 *   node benchmark/run.mjs --threshold 30       flags deltas from this percentage on (default 30)
 *   node benchmark/run.mjs --rounds 15          macro rounds (default 9), more rounds for noisier machines
 *
 * The base is measured in a scratch workspace in the temp directory: `src/` and `index.js` of the base commit,
 * `benchmark/` and node_modules of the working tree. Same harness, same machine, same minute, so the deltas mean
 * something even on a shared CI runner.
 *
 * Writes benchmark/results/latest.json, latest.md and, with --base, base.json.
 */
import { execSync, spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { arch, cpus, platform, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatMarkdown } from './report.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const resultsDir = join(root, 'benchmark', 'results');

const args = process.argv.slice(2);
const option = (name) => {
    const index = args.indexOf(name);
    return index === -1 ? undefined : args[index + 1];
};
const base = option('--base');
const micro = args.includes('--micro');
const threshold = Number(option('--threshold') ?? 30);
const rounds = option('--rounds') ?? '';

// where the numbers come from, so that a report can never be mistaken for one from another machine
const machine = process.env.GITHUB_ACTIONS
    ? ['GitHub Actions', `${process.env.RUNNER_OS ?? '?'} ${process.env.RUNNER_ARCH ?? ''}`.trim(), process.env.ImageOS]
          .filter(Boolean)
          .join(', ')
    : `local, ${platform()} ${arch()}, ${cpus()[0]?.model ?? 'unknown cpu'}`;

const git = (command, cwd = root) => {
    try {
        return execSync(`git ${command}`, { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
            .toString()
            .trim();
    } catch {
        return undefined;
    }
};

const runBenchmark = (cwd, env) => {
    const result = spawnSync(
        join(root, 'node_modules', '.bin', 'web-test-runner'),
        ['--config', 'benchmark/web-test-runner.config.js'],
        { cwd, stdio: 'inherit', env: { ...process.env, ...env } },
    );
    if (result.status !== 0) {
        throw new Error(`benchmark run failed in ${cwd}`);
    }
    return JSON.parse(readFileSync(join(cwd, 'benchmark', 'results', 'latest.json'), 'utf8'));
};

console.log(`\n▶ benchmark: working tree${micro ? ' (with micro)' : ''}`);
// CI passes the pull request's head and base names in, a checkout there is detached and HEAD is a merge commit
const headRef = process.env.BENCH_GIT_REF || git('rev-parse --abbrev-ref HEAD');
const head = runBenchmark(root, {
    BENCH_MICRO: micro ? '1' : '',
    BENCH_ROUNDS: rounds,
    BENCH_MACHINE: machine,
    BENCH_GIT_SHA: (process.env.BENCH_GIT_SHA || git('rev-parse --short HEAD') || '').slice(0, 7),
    BENCH_GIT_REF: headRef === 'HEAD' ? '' : headRef ?? '',
    BENCH_GIT_DIRTY: git('status --porcelain -- src index.js') ? '1' : '',
});

let baseResults;
if (base) {
    const sha = git(`rev-parse --short ${base}`);
    if (!sha) {
        throw new Error(`unknown git ref "${base}"`);
    }
    // a scratch workspace outside the repository: base sources, the working tree's harness and node_modules
    const workspace = mkdtempSync(join(tmpdir(), 'element-js-bench-'));
    execSync(`git archive ${base} src index.js | tar -x -C "${workspace}"`, { cwd: root, stdio: 'inherit' });
    cpSync(join(root, 'benchmark'), join(workspace, 'benchmark'), {
        recursive: true,
        filter: (source) => !source.startsWith(resultsDir),
    });
    // "type": "module" is needed for the config file, without a package.json web-test-runner hangs while loading it
    copyFileSync(join(root, 'package.json'), join(workspace, 'package.json'));
    symlinkSync(join(root, 'node_modules'), join(workspace, 'node_modules'), 'dir');

    console.log(`\n▶ benchmark: base ${base} (${sha})`);
    // the micro variants live in the harness and would be identical, the base run skips them
    try {
        baseResults = runBenchmark(workspace, {
            BENCH_MICRO: '',
            BENCH_ROUNDS: rounds,
            BENCH_MACHINE: machine,
            BENCH_GIT_SHA: sha,
            BENCH_GIT_REF: process.env.BENCH_BASE_REF || (/^[0-9a-f]{40}$/.test(base) ? '' : base),
            BENCH_GIT_DIRTY: '',
        });
    } finally {
        rmSync(workspace, { recursive: true, force: true });
    }
    writeFileSync(join(resultsDir, 'base.json'), JSON.stringify(baseResults, null, 2) + '\n');
}

const markdown = formatMarkdown(head, { base: baseResults, threshold });
writeFileSync(join(resultsDir, 'latest.md'), markdown);
process.stdout.write(`\n${markdown}`);
