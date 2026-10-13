import { mkdir, writeFile } from 'node:fs/promises';
import { chromeLauncher } from '@web/test-runner';

const RESULTS_DIR = 'benchmark/results';

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
            name: 'benchmark-results',
            async executeCommand({ command, payload }) {
                if (command !== 'benchmark-results') return undefined;
                await mkdir(RESULTS_DIR, { recursive: true });
                await writeFile(`${RESULTS_DIR}/latest.json`, JSON.stringify(payload, null, 2) + '\n');
                return true;
            },
        },
    ],
};
