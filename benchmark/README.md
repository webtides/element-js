# Rendering benchmark

Measures the renderer in `src/dom-parts/`. No build step, runs straight against the sources.

```bash
npm run bench       # headless Chrome via web-test-runner, ~30 s, prints a Markdown report
npm run bench:ui    # dev server + page at http://localhost:8000/benchmark/ for manual runs and debugging
```

`npm run bench` writes `benchmark/results/latest.json` and `benchmark/results/latest.md` (gitignored) and prints the report. `node benchmark/report.mjs [file.json]` formats any saved result again. Numbers never fail the run, only a broken benchmark does.

CI runs `npm run bench` on every pull request (`.github/workflows/benchmark.yml`), uploads the results as artifact and posts the report as a sticky comment on the PR. Shared runners are noisy, so the comment is for the probes and for order-of-magnitude changes, not for gating. To compare numbers, run before and after on the same machine.

## What it measures

**Macro: `render()`.** End-to-end rendering of a js-framework-benchmark style table with that benchmark's operation set: create, replace all, partial update, select, swap, remove, append, clear, create many, plus `hydrate rows` (render into server markup produced by `toString()`). Two probes report whether updates after a client render and after a hydration actually reach the DOM. The interactive version of this table lives in `examples/index.html` (`example-template-element.js`).

**Micro: part binding.** The cost of binding parts to a freshly cloned template fragment. Compares the current path based lookup (`part.path.reduceRight(...)` in `TemplatePart.parseValue`) against TreeWalker based lookups. Every variant includes the `importNode` clone, `clone-only` is the floor. All variants must resolve the same nodes, this is verified before measuring and reported per variant.

| variant | what it does |
| --- | --- |
| `clone-only` | `document.importNode(fragment, true)`, nothing else. The floor. |
| `path reduceRight (current)` | What `TemplatePart.parseValue` does today: precomputed `childNodes` index paths, one `reduceRight` per part. |
| `walker comments, N from data` | `createTreeWalker(clone, SHOW_COMMENT)`, reads `N` from `dom-part-N` via `parseInt`, binds `parts[N]`. |
| `walker comments, ordinal` | Same walker, no parsing, k-th part marker in document order binds `parts[k]`. |
| `walker nodeIndex (lit)` | lit's approach: `SHOW_ELEMENT \| SHOW_COMMENT` walker, compares a running node index against precomputed indices. |

Shapes: `row` (js-framework-benchmark `<tr>`, 4 parts), `deep` (11 nested elements, 2 parts at the bottom), `wide` (150 static siblings before 3 parts, worst case for walkers).

## Method

-   Each micro variant is warmed up for 200 ms wall-clock before sampling so the engine has finished tiering.
-   Samples are a few milliseconds long: long enough for the coarsened `performance.now()` resolution (0.1 ms without cross-origin isolation), short enough that garbage collection pauses hit single samples and not the median. Variants rotate order per sample. `min` is the floor.
-   `binding overhead` is the variant median minus the `clone-only` median. `× current` relates that overhead to the path lookup.
-   Macro rounds use a fresh container each time and deterministic data (seeded PRNG), so every round renders the same rows.
-   The manual page records whether the tab was hidden during a run (`hiddenDuringRun`). Chromium schedules extra garbage collection for hidden tabs, which can inflate micro medians up to 10× while the minimums and the macro numbers stay put. A median far above its min is the tell. Headless runs are not affected.

Files: `core.js` (measurement, browser only), `run.bench.js` (headless entry, web-test-runner), `web-test-runner.config.js` (writes the JSON), `report.mjs` (Markdown), `index.html` + `page.js` (manual page).

## Baseline

`main` @ `c29a37f` (v1.2.12), `npm run bench`, headless Chrome 155, Apple M1 Max, 2026-10-13. Defaults: 30 × 2000 iterations per micro variant, 9 macro rounds, 1000 rows.

### Macro, ms (median / min)

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

### Micro, binding overhead in µs per clone (median), relative to the current path lookup

| shape | clone-only | path (current) | walker comments, N | walker comments, ordinal | walker nodeIndex (lit) |
| --- | --: | --: | --: | --: | --: |
| row: 27 nodes, 4 parts, path length 4 | 2.15 µs | 1.10 µs (1×) | 0.62 µs (0.57×) | 0.55 µs (0.50×) | 0.60 µs (0.55×) |
| deep: 39 nodes, 2 parts, path length 12 | 2.80 µs | 2.35 µs (1×) | 0.30 µs (0.13×) | 0.30 µs (0.13×) | 0.80 µs (0.34×) |
| wide: 312 nodes, 3 parts, path length 3 | 31.55 µs | 1.35 µs (1×) | 1.00 µs (0.74×) | 1.67 µs (1.24×) | 9.15 µs (6.78×) |

Reading:

-   The comment-only walker is cheaper than the path lookup in `row` and `deep`, and its cost does not grow with nesting depth. The path lookup doubles from `row` to `deep`.
-   In `wide` the differences between path and comment walkers are within noise (overheads of 1–2 µs on a 31 µs clone, sign flips between runs). The walker skips the 150 static elements natively.
-   lit's element+comment walker pays for every element it visits: consistently 7–9 µs extra in `wide`. If a walker is adopted, it should be `SHOW_COMMENT` only.

Side note from the baseline: `clear rows` is slower than `create rows`. `removeNodesBetweenComments` walks `previousSibling` across all row nodes and removes them one by one. Not part of #168, worth a look on its own.
