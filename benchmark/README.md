# Rendering benchmark

Measures the renderer in `src/dom-parts/`. No build step, runs straight against the sources, headless, about 15 s.

```bash
npm run bench                              # working tree, prints the report
npm run bench:compare                      # working tree vs main, same harness, deltas flagged from 30% on
node benchmark/run.mjs --base v1.2.12      # any git ref as base
node benchmark/run.mjs --micro             # include the part binding strategies
npm run bench:ui                           # dev server + page at http://localhost:8000/benchmark/ for manual runs
```

Results land in `benchmark/results/` (gitignored): `latest.json`, `latest.md` and, with a base, `base.json`. `node benchmark/report.mjs [head.json] [--base base.json]` formats saved results again. Numbers never fail a run, only a broken benchmark does.

## What the report shows

```
### Renderer benchmark

`fix/168` 3f2a1c9 vs base `main` c29a37f · Chrome/155 headless, 4 cores, 2026-10-14

**2 of 10 operations deviate 30% or more from base:** create rows -36% ✅, hydrate rows -35% ✅

Probes: client updates reach DOM: yes · hydrated updates reach DOM: yes (base: **no**)

| operation, `render()` with 1000 rows, median of 9 | base ms | head ms | Δ |
| --- | ---: | ---: | ---: |
| create rows | 14.5 | 9.3 | **-36%** ✅ |
| partial update | 3.8 | 3.8 | 0% |
…
```

-   **Base** is the commit you compare against, measured right after the working tree in a scratch workspace: `src/` and `index.js` of that commit, `benchmark/` and `node_modules` of the working tree. Same harness, same machine, same minute. That is what makes the deltas usable on a shared CI runner, where absolute numbers drift from run to run.
-   **Δ** is the change of the median. From the threshold on (default 30%, `--threshold`) it is bold and flagged: ✅ faster, ⚠️ slower. The summary line lists the flagged operations, so a comment can be judged from its first line.
-   **Probes** are correctness checks that come with the macro run: do updates after a client render and after a hydration reach the DOM. A probe that differs from base is called out.
-   **Micro** (`--micro`) is a collapsed extra: the cost of binding parts to a freshly cloned template for several strategies, implemented inside the harness. It does not call the library, so it is identical on every commit and never compared. It exists to decide how binding should work, see below.

## CI

`.github/workflows/benchmark.yml` runs on every pull request, measures the PR's base commit in the same job, uploads the results as artifact and posts the report as a sticky comment on the PR. Pushes to `main` run without a base.

## What it measures

**Macro: `render()`.** End-to-end rendering of a js-framework-benchmark style table with that benchmark's operation set: create, replace all, partial update, select, swap, remove, append, clear, create many, plus `hydrate rows` (render into server markup produced by `toString()`). Rounds use a fresh container each time and deterministic data (seeded PRNG), so every round renders the same rows. The interactive version of this table lives in `examples/index.html` (`example-template-element.js`).

**Micro: part binding.** Clone the template fragment and resolve every part node, for three template shapes: `row` (js-framework-benchmark `<tr>`, 4 parts), `deep` (11 nested elements, 2 parts at the bottom), `wide` (150 static siblings before 3 parts, the worst case for walkers). Every strategy includes the `importNode` clone, `clone only` is the floor, and all strategies are verified to resolve the same nodes.

| strategy | what it does |
| --- | --- |
| `path` | Precomputed `childNodes` index paths, one `reduceRight` per part. What `TemplatePart` did up to 1.2.12. |
| `walker N` | `createTreeWalker(clone, SHOW_COMMENT)`, reads `N` from the `dom-part-N` marker, binds `parts[N]`. |
| `walker ordinal` | Same walker without parsing, the k-th part marker in document order binds `parts[k]`. |
| `walker lit` | lit's approach: `SHOW_ELEMENT \| SHOW_COMMENT` walker, compares a running node index against precomputed indices. |

Method: each strategy is warmed up for 200 ms wall-clock before sampling. Samples are a few milliseconds long, long enough for the coarsened `performance.now()` resolution (0.1 ms without cross-origin isolation), short enough that garbage collection pauses hit single samples and not the median. Strategies rotate order per sample. The manual page records whether the tab was hidden during a run (`hiddenDuringRun`), hidden tabs get extra garbage collection that can inflate medians up to 10× while minimums stay put. Headless runs are not affected.

Files: `run.mjs` (CLI, runs head and base, prints), `core.js` (measurement, browser only), `run.bench.js` (headless entry for web-test-runner), `web-test-runner.config.js` (hands config in, writes the JSON), `report.mjs` (Markdown), `index.html` + `page.js` (manual page).

## Baseline and the binding decision

`main` @ `c29a37f` (v1.2.12), headless Chrome 155, Apple M1 Max, defaults. Macro, ms (median / min):

| operation        |          ms |
| ---------------- | ----------: |
| create rows      | 14.5 / 12.7 |
| replace all rows |   5.0 / 4.5 |
| partial update   |   3.8 / 3.6 |
| select row       |   3.8 / 3.3 |
| swap rows        |   3.6 / 3.5 |
| remove row       |   4.3 / 4.1 |
| append rows      | 13.5 / 12.7 |
| clear rows       | 20.8 / 19.5 |
| create many rows | 95.3 / 85.4 |
| hydrate rows     |  10.4 / 9.1 |

Probes: client updates reach the DOM: yes. Hydrated updates reach the DOM: **no** (#168).

Micro, binding overhead in µs per clone (median):

| shape                             | clone only | path | walker N | walker ordinal | walker lit |
| --------------------------------- | ---------: | ---: | -------: | -------------: | ---------: |
| row: 27 nodes, 4 parts, depth 4   |       2.15 | 1.10 |     0.62 |           0.55 |       0.60 |
| deep: 39 nodes, 2 parts, depth 12 |       2.80 | 2.35 |     0.30 |           0.30 |       0.80 |
| wide: 312 nodes, 3 parts, depth 3 |      31.55 | 1.35 |     1.00 |           1.67 |       9.15 |

-   The comment-only walker is cheaper than the path lookup in `row` and `deep`, and its cost does not grow with nesting depth. The path lookup doubles from `row` to `deep`.
-   In `wide` the differences between path and comment walkers are within noise (1–2 µs on a 31 µs clone, sign flips between runs). The walker skips the 150 static elements natively.
-   lit's element+comment walker pays for every element it visits, 7–9 µs extra in `wide`. A walker here has to be `SHOW_COMMENT` only.

Side note from the baseline: `clear rows` is slower than `create rows`. `removeNodesBetweenComments` walks `previousSibling` across all row nodes and removes them one by one. Not part of #168, worth a look on its own.
