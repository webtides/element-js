import { mkdir, writeFile } from 'node:fs/promises';
import { chromeLauncher } from '@web/test-runner';

const RESULTS_DIR = 'benchmark/results';

/**
 * Configuration and git information come from `benchmark/run.mjs` through the environment, so that the same
 * harness can run against a scratch workspace of another commit.
 */
const config = {
    micro: process.env.BENCH_MICRO === '1',
    rounds: Number(process.env.BENCH_ROUNDS) || undefined,
};

const git = {
    sha: process.env.BENCH_GIT_SHA || undefined,
    ref: process.env.BENCH_GIT_REF || undefined,
    dirty: process.env.BENCH_GIT_DIRTY === '1',
};

export default {
    files: ['benchmark/run.bench.js'],
    nodeResolve: true,
    concurrency: 1,
    browsers: [chromeLauncher({ concurrency: 1 })],
    testFramework: {
        config: {
            timeout: 300000,
        },
    },
    plugins: [
        {
            name: 'benchmark',
            async executeCommand({ command, payload }) {
                if (command === 'benchmark-config') {
                    return config;
                }
                if (command === 'benchmark-results') {
                    await mkdir(RESULTS_DIR, { recursive: true });
                    const results = { git, machine: process.env.BENCH_MACHINE || undefined, ...payload };
                    await writeFile(`${RESULTS_DIR}/latest.json`, JSON.stringify(results, null, 2) + '\n');
                    return true;
                }
                return undefined;
            },
        },
    ],
};
