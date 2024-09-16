import { chromeLauncher } from '@web/test-runner';

export default {
    browsers: [
        chromeLauncher({
            concurrency: 1, // https://github.com/open-wc/open-wc/issues/2813#issuecomment-2317609810
        }),
    ],
    coverageConfig: {
        reportDir: 'test/coverage',
    },
    testRunnerHtml: (testFramework) =>
        `<html>
      <body>
        <script>globalThis.elementJsConfig = { observeGlobalStyles: true };</script>
        <script type="module" src="${testFramework}"></script>
      </body>
    </html>`,
};
