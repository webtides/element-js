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

An example:

```
### Renderer benchmark

`fix/168` 3f2a1c9 vs base `main` c29a37f · GitHub Actions, Linux X64, ubuntu24 · Chrome/154 headless, 4 cores, 2026-10-14

**2 of 10 operations deviate 30% or more from base:** create rows -36% ✅, hydrate rows -35% ✅

**1 operation could not be measured on base:** hydrate rows (DOM did not update after hydration)

| operation, `render()` with 1000 rows, median of 9 | base ms | head ms | Δ median | Δ min |
| --- | ---: | ---: | ---: | ---: |
| create rows | 14.5 | 9.3 | **-36%** ✅ | **-34%** |
| partial update | 3.8 | 3.8 | 0% | -3% |
…
| hydrate rows | invalid | 6.8 |  |  |
```

-   **Base** is the commit you compare against, measured right after the working tree in a scratch workspace: `src/` and `index.js` of that commit, `benchmark/` and `node_modules` of the working tree. Same harness, same machine, same minute. That is the only comparison the report makes. The header names the machine (`GitHub Actions, …` or `local, …`), and a base measured elsewhere is called out and never flagged.
-   **Δ median / Δ min** are the changes of the median and of the fastest round. An operation is flagged (bold, ✅ faster, ⚠️ slower) when both move at least the threshold (default 30%, `--threshold`) in the same direction. A single slow round moves the median but not the min, which is what shared runners mostly produce. The summary line lists the flagged operations, so a comment can be judged from its first line.
-   **Invalid measurements.** Every operation has a post-condition on the DOM (row count, changed label, selected class), like js-framework-benchmark checks the page after each step. If it fails, the number would describe something the renderer did not do, so the cell says `invalid` and the reason is listed above the table. No delta is computed for that operation. The behaviour itself is covered by the unit tests, not by the benchmark.
-   **Micro** (`--micro`) is a collapsed extra: the cost of binding parts to a freshly cloned template for several strategies, implemented inside the harness. It does not call the library, so it is identical on every commit and never compared. It exists to decide how binding should work, see below.

## CI

`.github/workflows/benchmark.yml` runs on every pull request, measures the PR's base commit in the same job with 15 rounds (`--rounds`), uploads the results as artifact and posts the report as a sticky comment on the PR. Pushes to `main` run without a base.

## What it measures

**Macro: `render()`.** End-to-end rendering of a js-framework-benchmark style table with that benchmark's operation set: create, replace all, partial update, select, swap, remove, append, clear, create many, plus `hydrate rows` (render into server markup produced by `toString()`, valid only if a change reaches the DOM on the next render). Rounds use a fresh container each time and deterministic data (seeded PRNG), so every round renders the same rows. The interactive version of this table lives in `examples/index.html` (`example-template-element.js`).

**Micro: part binding.** Clone the template fragment and resolve every part node, for three template shapes: `row` (js-framework-benchmark `<tr>`, 4 parts), `deep` (11 nested elements, 2 parts at the bottom), `wide` (150 static siblings before 3 parts, the worst case for walkers). Every strategy includes the `importNode` clone, `clone only` is the floor, and all strategies are verified to resolve the same nodes.

| strategy | what it does |
| --- | --- |
| `path` | Precomputed `childNodes` index paths, one `reduceRight` per part. What `TemplatePart` did up to 1.2.12. |
| `walker N` | `createTreeWalker(clone, SHOW_COMMENT)`, reads `N` from the `<!--N-->` marker, binds `parts[N]`. |
| `walker ordinal` | Same walker without parsing, the k-th part marker in document order binds `parts[k]`. |
| `walker lit` | lit's approach: `SHOW_ELEMENT \| SHOW_COMMENT` walker, compares a running node index against precomputed indices. |

Method: each strategy is warmed up for 200 ms wall-clock before sampling. Samples are a few milliseconds long, long enough for the coarsened `performance.now()` resolution (0.1 ms without cross-origin isolation), short enough that garbage collection pauses hit single samples and not the median. Strategies rotate order per sample. The manual page records whether the tab was hidden during a run (`hiddenDuringRun`), hidden tabs get extra garbage collection that can inflate medians up to 10× while minimums stay put. Headless runs are not affected.

Files: `run.mjs` (CLI, runs head and base, prints), `core.js` (measurement, browser only), `run.bench.js` (headless entry for web-test-runner), `web-test-runner.config.js` (hands config in, writes the JSON), `report.mjs` (Markdown), `index.html` + `page.js` (manual page).

## The binding decision

Numbers live in the pull request comments, measured on the CI runner, base against head. Nothing here quotes a machine.

The micro benchmark settled how parts get bound to a template clone. Relative to the former path lookup (`reduceRight` over precomputed `childNodes` indices), measured on one machine with the strategies rotating per sample:

| shape                             | walker N | walker ordinal | walker lit |
| --------------------------------- | -------: | -------------: | ---------: |
| row: 27 nodes, 4 parts, depth 4   |    ~0.5× |          ~0.5× |      ~0.6× |
| deep: 39 nodes, 2 parts, depth 12 |   ~0.15× |         ~0.15× |     ~0.35× |
| wide: 312 nodes, 3 parts, depth 3 |      ~1× |            ~1× |        ~7× |

-   The comment-only walker is cheaper than the path lookup in `row` and `deep`, and its cost does not grow with nesting depth. The path lookup doubles from `row` to `deep`.
-   In `wide` the differences between path and comment walkers are within noise, the walker skips the 150 static elements natively.
-   lit's element+comment walker pays for every element it visits. A walker here has to be `SHOW_COMMENT` only.

`walker N` is what `TemplatePart` does since #168. The strategies stay in the harness (`--micro`) so the comparison can be rerun on any machine.

Side note from the first runs: `clear rows` is slower than `create rows`. `removeNodesBetweenComments` walks `previousSibling` across all row nodes and removes them one by one. Not part of #168, worth a look on its own.
