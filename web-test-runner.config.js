export default {
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
