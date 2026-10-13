/**
 * Headless benchmark run, executed by web-test-runner (`npm run bench`).
 * Sends the results to the server side plugin in web-test-runner.config.js, which writes benchmark/results/.
 * Numbers never fail this run, only a broken benchmark does.
 */
import { executeServerCommand } from '@web/test-runner-commands';
import { defaults, environment, runMacro, runMicro } from './core.js';

describe('renderer benchmark', () => {
    it('measures part binding and render()', async () => {
        const host = document.createElement('div');
        document.body.append(host);

        const micro = await runMicro(defaults);
        const macro = await runMacro({ ...defaults, host });

        host.remove();

        await executeServerCommand('benchmark-results', {
            environment: { ...environment(), headless: true },
            hiddenDuringRun: document.hidden,
            micro,
            macro,
        });
    });
});
