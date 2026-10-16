/**
 * Headless benchmark run, executed by web-test-runner through `benchmark/run.mjs`.
 * Asks the server side plugin (web-test-runner.config.js) for the configuration and hands the results back to it.
 * Numbers never fail this run, only a broken benchmark does.
 */
import { executeServerCommand } from '@web/test-runner-commands';
import { defaults, environment, runMacro, runMicro } from './core.js';

describe('renderer benchmark', () => {
    it('measures render() and, on request, part binding', async () => {
        const config = (await executeServerCommand('benchmark-config')) ?? {};

        const host = document.createElement('div');
        document.body.append(host);

        const macro = await runMacro({ ...defaults, rounds: config.rounds ?? defaults.rounds, host });
        const micro = config.micro ? await runMicro(defaults) : null;

        host.remove();

        await executeServerCommand('benchmark-results', {
            environment: { ...environment(), headless: true },
            hiddenDuringRun: document.hidden,
            macro,
            micro,
        });
    });
});
