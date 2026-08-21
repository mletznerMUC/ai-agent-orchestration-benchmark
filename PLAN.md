# Plan: Publish the per-dimension rubric breakdown and let visitors reweight it
Branch: feature/dimension-weighting

All paths are repo-relative to
`/Users/mletzner/Library/CloudStorage/OneDrive-StroeerGlobalDirectory/Documents/GitHub/OpenRTB/ai-agent-orchestration-benchmark`.
Line numbers are as of `main` @ `3b00cd2` and shift as steps land; every step
also names a unique anchor string to search for.

Revised after the expert panel returned APPROVE WITH CHANGES. All 17
consolidated changes are folded in, plus the two owner's calls Markus decided
(A: `<details>` disclosure; B: 2-decimal display).

## Non-goals

- **No changelog entry and no `meta.asOf` change.** This is a site feature, not
  a data round. `scripts/verify.mjs:106` requires `asOf === newsDates[0]`, so
  adding a news entry would force a `data/tools.json` edit, which Verification 4
  forbids.
- **No change to any score, weight, `raw`, `max`, `exact`, matrix cell, price,
  descriptor or badge.** `data/tools.json` is not edited at all.
- **No build step, framework or dependency.**

## Acceptance criteria amended by the owner's calls

Two criteria from the task cards no longer describe what is being built, and
are replaced here so the reviewer measures the right thing:

- Card 1, "All six dimensions visible per tool on both pages" → **all six
  dimensions reachable per tool on both pages behind a one-click
  `<details>` disclosure that works with JavaScript disabled**, labels matching
  the Methodology table.
- Card 1, "Displayed dimension points sum to the published `score.exact`" →
  **each displayed dimension figure equals `weight*raw/max` rounded half-up to
  2 decimals, and the exact `raw` / `max` / `weight` the figure is derived from
  are published beside it and checked against `data/tools.json`.** The exact
  arithmetic claim moves to `raw`/`max`/`weight`; the 2-dp display figures are
  not claimed to sum to `score.exact`, and nothing checks them against it. The
  page says the figures are rounded.

## Key design decisions this plan makes

**D1 — Dimension figures are static HTML, crosschecked by `verify`.** Not a
runtime `fetch` of `data/tools.json`. Three reasons. (a) ADR-001 makes
`tools.json` an *assertion about* the served pages, not a runtime input; making
the page fetch it turns the assertion into a dependency and removes the thing
`verify` proves. (b) A runtime fetch fails under `file://` (CORS), and the whole
test suite plus the compare modal are built on reading values out of the served
HTML. (c) ADR-005's warning is against an *uncrosschecked* second copy — this
copy is checked figure-by-figure by `verify` and `npm test`, exactly as the 24
published score numbers already are. Consequence: the plan owes a real parser
and real verifier checks (steps 2–3), and pays it before the figures land.

**D2 — No new copy of the published weights.** `points` is displayed but
`weight` is not repeated per card. The six published weights already exist once
per page in the Methodology table (`index.html` lines 1849–1854). Step 1 keys
those rows with `data-dim`, step 3 checks them against `tools.json`, and the
weighting engine and the verifier both read them from there. Each weight exists
once per page and is verified.

**D3 — Dimension labels are checked against the Methodology table, not
duplicated in `tools.json`.** `verify` compares each card's `.dim-name` text to
the matching Methodology row's first cell, byte-for-byte, and pins the six
labels per language in the parser tests (step 2). That makes card 1's "labels
matching the Methodology table" a machine check, and adds no data to
`tools.json`.

**D4 (owner's call B) — Displayed points are rounded half-up to 2 decimals.**
Display value = `Math.floor(weight * raw / max * 100 + 0.5) / 100`, written as
its shortest exact decimal (`25`, `7.5`, `3.33`, `15.63`). `verify` recomputes
that expression and compares to `Number(displayText)` with `===` — no tolerance
window. Exact equality is safe: both sides are the correctly-rounded double of
the same 2-decimal decimal. The panel confirmed the only non-terminating point
values in the rubric come from the accessibility dimension (weight 10 over max
6) — in the current data `3.3333` and `8.3333`, displaying as `3.33` and
`8.33` — and that no rounded sum crosses a half-up boundary that full precision
does not. **No check depends on that**: the recomputed-total-equals-published
check runs on full precision (step 3), and the display rounding must not enter
the engine (step 8).

**D5 — Reserved class-name rule.** The weighting panel sits between the score
grid and `<!-- Feature Matrix -->`, which means it lands inside the slice
`parseScores` reads (the slice ends at the matrix comment, so everything after
the grid is appended to the *last* score card's chunk — `manus-ai`, the unrated
one). Therefore every **new** id and class in the panel is prefixed `wt-`, and
no panel markup may contain the strings `score-number`, `score-bar-fill`,
`score-descriptor`, `<div class="score-card` or `<div class="dim`. The panel
does reuse the existing `section` / `section-header` / `section-title` classes —
inventing `wt-` twins of those would fork the page's styling for no gain. Step 9
enforces the rule with occurrence *counts* over the whole slice, not a negative
match over the panel alone.

**D6 — Display order follows the Methodology table, not JSON key order.** The
table order is orchestration, operability, integration, sovereignty,
**maturity, accessibility** (weights 25/20/15/15/15/10). `tools.json` stores
accessibility *before* maturity. Do not copy JSON key order — and note that
`integration` and `maturity` share both weight (15) and max (6), so a swap
between those two is invisible to the weight check and the max check. Only the
pinned labels (step 2) and the label-vs-table check (step 3) catch it.

**D7 — Decimal separator is a dot in both languages.** The DE page does use
decimal commas in prose (`$0,08/Session-h`, `index.html:1890`), so `3,33` would
be the German convention. The plan uses `3.33` on both pages: it keeps one
string set, matches the mono/technical presentation of `data-raw`, `data-max`
and the Methodology table, and lets `verify` assert the DE and EN figure strings
are byte-identical. Flagged in Risks as an owner-visible choice.

## Steps

Ordering note: the parser and verifier land **before** the figures, so no
unchecked figure ever sits in the repo under a green `verify`.
**`npm run verify`, the `verify.test.mjs:19` "unmodified site verifies clean"
test, and step 2's tests that read the real HTML files are expected to fail from
step 2 until step 5 lands. Do not weaken any assertion to make them pass.**
Intermediate red on a feature branch costs nothing — nothing merges without the
gate — while 144 unchecked figures sitting under a green `verify` is precisely
the state this project's standards are hostile to. (ADR-003 is about not merging
a `refresh:proposed` PR while `verify` is red; it says nothing about
intermediate commits on a feature branch.)

1. [x] Key the Methodology table rows with their rubric dimension slug, in both files
   - Files: `index.html` (lines 1849–1854), `index.en.html` (lines 1810–1815)
   - Change only the opening tag of each of the six `<tr>`: `<tr>` →
     `<tr data-dim="orchestration">`, then `operability`, `integration`,
     `sovereignty`, `maturity`, `accessibility` — in the order the rows already
     appear. The label, weight and criteria cells stay byte-identical.
   - Done when: `grep -c 'tr data-dim=' index.html index.en.html` prints `6` for
     both files, `git diff` shows twelve changed lines and nothing else, and
     `npm run verify` and `npm test` are still green.

2. [x] Teach the parser to read dimensions and published weights
   - Files: `scripts/lib/parse-html.mjs`, `scripts/lib/parse-html.test.mjs`
   - Add `parseDimensions(html)`: reuse the existing slice
     (`'<div class="score-grid">'` → `'<!-- Feature Matrix -->'`) and the
     existing `split('<div class="score-card')` chunking, then split each chunk
     on `<div class="dim` and read each row's attributes *individually* (never
     by attribute order): `data-dim`, `data-max`, optional `data-raw`, plus the
     `dim-name` / `dim-raw` / `dim-points` span texts. The `dim-name` regex must
     tolerate attributes on the span (`<span class="dim-name"[^>]*>`) because
     that span carries a `title` (step 4); return the `title` value too. Return
     `Map<toolKey, Array<{key, name, title, raw, max, points, rawLabel}>>` with
     row order preserved, `raw: null` when `data-raw` is absent, `points: null`
     when the `dim-points` text is not a number. Throw on: a card with no rows,
     a row with no `data-dim`, a row with no `data-max`, a row that has
     `data-raw` but a non-numeric `dim-points` or vice versa.
   - Add `parseWeights(html)`: slice `'<!-- Methodology -->'` →
     `'<!-- News / Changelog -->'` (confirm with `grep -c` that each marker
     occurs once per file before relying on `sliceBetween`, which silently takes
     the first), read the `<tr data-dim>` rows, return `Map<dim, {label, weight}>`
     in document order. Throw if fewer than six rows.
   - Do not touch `parseScores`, `parseMatrix`, `parsePrices`, `parseMeta`, or
     `parseScores`'s markers.
   - Tests, in the existing fixture-plus-real-file style:
     - a fixture with rows in *scrambled* order proves keying is by `data-dim`,
       not position;
     - a fixture proves the `dim-name` regex survives a `title` attribute;
     - `parseWeights` returns slugs
       `['orchestration','operability','integration','sovereignty','maturity','accessibility']`
       with weights `[25,20,15,15,15,10]` in both real files, **and** the six
       labels pinned verbatim per language — DE `Orchestrierung`,
       `Betreibbarkeit`, `Integration`, `Deployment-Souveränität`,
       `Release-Reife`, `Zugänglichkeit`; EN `Orchestration`, `Operability`,
       `Integration`, `Deployment sovereignty`, `Release maturity`,
       `Accessibility`. This is what closes the `integration`/`maturity` swap
       (D6);
     - `parseDimensions` finds 12 cards × 6 rows = 72 rows in both real files,
       and `manus-ai`'s maturity row parses as `raw: null, points: null` — these
       two are **expected red until step 5**.
   - Done when: `npm test` shows exactly the expected failures above and no
     others; the existing `parseScores` / `parseMatrix` / `parsePrices` /
     `parseMeta` tests are untouched in the diff.

3. [x] Make `verify` fail on any hand-altered dimension figure
   - Files: `scripts/verify.mjs`, `scripts/verify.test.mjs`
   - Inside `collectFailures`'s per-file loop (parse block lines 20–30, per-tool
     block lines 42–101), parse dimensions and weights in the same `try` and
     add, per file and `lang`:
     - the six `data-dim` keys per card equal the six `score.rubric` keys as a
       *set*, and their document order equals `parseWeights` order (D6);
     - per dimension: `max` === `rubric[dim].max`; `raw` === `rubric[dim].raw`
       (null-aware — `data-raw` present where JSON says `null`, or absent where
       JSON has a number, is a failure);
     - per dimension, the displayed figure: `Number(points)` ===
       `Math.floor(weight * raw / max * 100 + 0.5) / 100` using the weight from
       `parseWeights`, compared with `===`, no tolerance (D4); null-aware for
       the unevidenced row;
     - `rawLabel` === `` `${raw}/${max}` `` for evidenced rows;
     - `name` === `parseWeights(html).get(dim).label` (D3), and
       `title` === `name` (the ellipsis title is not allowed to drift from the
       text it abbreviates);
     - per rated tool, on **full precision**, not on the displayed figures:
       `Σ (weight * raw / max)` equals `score.exact` within 0.005 and
       `Math.floor(Σ + 0.5)` === `score.value`;
     - per unrated tool: at least one parsed row has `raw === null`;
     - `parseWeights` weight per dimension === `rubric[dim].weight` for every
       tool (they are per-tool in JSON and identical across tools; report a
       failure if they are not).
   - Tests in `scripts/verify.test.mjs`, deriving fixtures from `DATA` like the
     existing ones (never hardcoded numbers — see the comment at line 12), each
     keeping the `assert.notEqual(broken, DE, 'fixture did not match')` guard:
     a hand-altered `dim-points` in DE only is caught; a hand-altered `data-raw`
     is caught; a `dim-name` drifted from the Methodology table is caught; a
     `title` drifted from its own `dim-name` is caught; a Methodology weight
     changed to disagree with `tools.json` is caught; removing `data-raw` from a
     rated row is caught; DE and EN carry byte-identical `data-raw`, `data-max`,
     `dim-raw` and `dim-points` strings for every tool (labels and titles may
     differ, D7); `manus-ai` still parses unrated in both files.
   - Done when: `npm test` shows only the expected step-2/step-3 real-file
     failures (they now include `collectFailures` reporting missing dimension
     rows) and no unexpected ones; every new tamper test fails the suite when
     its own assertion is inverted; `npm run verify` fails naming missing
     dimension rows rather than crashing.

4. [x] DE: add the per-dimension breakdown to all twelve score cards in `index.html`
   - Files: `index.html`
   - CSS: insert a `/* Rubric breakdown */` block immediately after the
     `.score-card.is-unrated` rule (line 400) and before `.method-table`
     (line 401). Classes: `.score-dims` (the `<details>`), `.score-dims-sum`
     (the `<summary>`), `.dim`, `.dim-name`, `.dim-raw`, `.dim-points`,
     `.dim.is-unevidenced`. Compact mono ~10px, one line per dimension, a
     hairline top border between the descriptor and the disclosure, the default
     `<summary>` marker replaced with something that reads as a control, and a
     visible `:focus-visible` outline on the summary. `.dim-name` needs an
     explicit overflow rule — the grid card is `minmax(200px, 1fr)` and
     `Deployment-Souveränität` is 23 characters: `min-width: 0; overflow: hidden;
     text-overflow: ellipsis; white-space: nowrap;` on a `1fr` column, with the
     full label in the span's `title`. It must introduce no class name starting
     with `score-number`, `score-bar-fill` or `score-descriptor`.
   - Markup: in each of the **twelve `<div class="score-card…" data-tool=`
     opening tags' cards** (four of which carry a modifier class — `is-adk`,
     `is-mcp`, `is-databricks`, `is-unrated` — so match on `data-tool`, not on
     `class="score-card"`), **after** the existing
     `<div class="score-descriptor">…</div>` line, insert:
     `<details class="score-dims"><summary class="score-dims-sum">Aufschlüsselung der Bewertung</summary>`
     + six `.dim` rows, one per line + `</details>`. Collapsed by default; no JS
     involved (owner's call A). One summary string per language, identical open
     and closed.
     Row shape (example: `maestro` / orchestration):
     `<div class="dim" data-dim="orchestration" data-max="8" data-raw="8"><span class="dim-name" title="Orchestrierung">Orchestrierung</span><span class="dim-raw">8/8</span><span class="dim-points">25</span></div>`
     - Rows in Methodology-table order (D6).
     - `data-raw` = `raw`, `data-max` = `max`, `dim-raw` text = `raw/max`, all
       from `data.tools[key].score.rubric[dim]`; `dim-points` text =
       `String(Math.floor(weight * raw / max * 100 + 0.5) / 100)` with the
       weight from the Methodology table (D4).
     - `dim-name` text **and** its `title` must be a byte-for-byte copy of the
       matching Methodology row's first cell, including literal umlauts
       (`Deployment-Souveränität`, `Zugänglichkeit`, `Release-Reife`).
     - `manus-ai`'s maturity row only: no `data-raw`, class
       `dim is-unevidenced`, `dim-raw` text `—`, `dim-points` text
       `nicht belegt`, and `data-reason="Release-Reife nicht aus datierter
       Primärquelle belegbar"` on the row (the engine reads this in step 8;
       also mirror it into the row's `title` for hover). Its other five rows are
       normal. The card keeps `is-unrated` and
       `<div class="score-unrated">Nicht bewertet</div>` and gains no number.
   - Method note: append one sentence to the existing `.method-note` paragraph
     (line 1858): the per-dimension figures on the score cards are rounded to
     two decimals, and the exact inputs (`raw`/`max`) are shown beside them.
   - Generate the 72 rows with a throwaway Node one-liner reading
     `data/tools.json` and paste the output — do not hand-type them, and do not
     commit the generator (no build step).
   - Done when: `grep -c 'class="dim"' index.html` prints `71`,
     `grep -c 'class="dim is-unevidenced"' index.html` prints `1`, and
     `grep -c '<details class="score-dims">' index.html` prints `12`;
     `npm run verify` now reports failures for `index.en.html` only; the DE page
     in a browser shows a closed disclosure on every card that opens to six
     labelled rows, with the compare checkboxes and modal still working.

5. [x] EN: the same breakdown in `index.en.html`
   - Files: `index.en.html`
   - Byte-identical CSS block in the same position. Identical markup and
     identical `data-raw` / `data-max` / `dim-raw` / `dim-points` values.
     English strings: summary `Rating breakdown`; `dim-name` and `title` copied
     byte-for-byte from the EN Methodology table (`Orchestration`,
     `Operability`, `Integration`, `Deployment sovereignty`, `Release maturity`,
     `Accessibility`); `manus-ai` maturity row `dim-points` text
     `not evidenced`, `data-reason="release maturity cannot be evidenced from a
     dated primary source"`. Append the equivalent rounding sentence to the EN
     `.method-note` (line 1819).
   - Done when: the three counts from step 4 hold for `index.en.html`;
     `diff <(grep -o 'data-dim="[a-z]*" data-max="[0-9]*"\( data-raw="[0-9]*"\)\?' index.html) <(grep -o 'data-dim="[a-z]*" data-max="[0-9]*"\( data-raw="[0-9]*"\)\?' index.en.html)`
     prints nothing; **`npm run verify` prints `OK` and `npm test` is fully
     green for the first time since step 2.**

6. [ ] DE: add the weighting panel markup and CSS to `index.html`
   - Files: `index.html`
   - Insert a new `<!-- Weighting Panel -->` section between the closing `</div>`
     of the Score Overview section (line 1243) and `<!-- Feature Matrix -->`
     (line 1245). CSS goes in an `/* Own weighting */` block after the rubric
     breakdown block from step 4, and must include
     `.section[hidden] { display: none; }` — `.section` declares no `display`
     today, so the UA rule for `[hidden]` currently wins only by luck.
   - Reuse `section` / `section-header` / `section-title`; every **new** class
     and every id is prefixed `wt-`; no reserved strings (D5). The section
     carries `hidden` — the engine removes it on init, so a no-JS visitor sees
     the published rating and the disclosures only, never a half-built control.
   - First line inside the section, an HTML comment: this panel sits inside the
     slice `parseScores` reads, every new class here is prefixed `wt-`, and the
     reserved class names are listed in `docs/decisions/006-*.md`. **The comment
     must not spell the reserved strings**, or it would trip step 9's own
     negative-match check.
   - Contents, in order: section title
     `Eigene Gewichtung — nicht die veröffentlichte Bewertung`; a persistent
     note `<p class="wt-note">Diese Reihenfolge entsteht aus Ihren Gewichten und
     gilt nur in diesem Browser. Die veröffentlichte Bewertung darüber bleibt
     unverändert. Gewichte werden auf 100 normalisiert.</p>`; **two** preset
     buttons `<button type="button" class="wt-preset" data-preset="published"
     aria-pressed="false">Veröffentlichte Gewichte</button>` and
     `data-preset="equal"` → `Gleich gewichtet`; six slider rows, each
     `<label for="wt-s-<dim>">` + `<input type="range" id="wt-s-<dim>"
     data-dim="<dim>" min="0" max="50" step="1">` + a
     `<span class="wt-pct" aria-hidden="true">` — **no `value` attribute** (the
     engine sets it from the Methodology table, so the published weights are not
     copied here, D2); a `<p class="wt-sum">` with **no `aria-live`** (it would
     fire on every `input` frame and be unusable with a screen reader; the range
     inputs announce their own values natively); a
     `<button type="button" id="wt-reset">Auf veröffentlichte Gewichte
     zurücksetzen</button>`; an empty `<div id="wt-ranking">` preceded by a
     `<div class="wt-head"><span>Ihre Gewichtung</span><span>Veröffentlicht</span></div>`
     column header; an empty `<div id="wt-unrated">`.
   - Slider labels use the same six strings as the Methodology table.
   - Done when: `npm run verify` and `npm test` are green (the panel is inert and
     contains no figures); the panel is invisible in the browser; the existing
     `verify.test.mjs:151` test still reports `manus-ai` as
     `score: null, barWidth: null`.

7. [ ] EN: the same panel in `index.en.html`
   - Files: `index.en.html`
   - Byte-identical CSS block and byte-identical structure (same ids, same
     `data-dim` / `data-preset` values, same element order); only visible
     strings change: `Your own weighting — not the published rating`; `This order
     comes from your weights and stays in this browser. The published rating
     above is unchanged. Weights are normalised to 100.`; `Published weights`,
     `Equal weights`; `Your weighting` / `Published`; `Reset to published
     weights`.
   - Done when: `diff <(grep -o 'id="wt-[a-z-]*"' index.html) <(grep -o 'id="wt-[a-z-]*"' index.en.html)`
     prints nothing, and the same holds for `data-preset="[a-z]*"` and for
     `data-dim="[a-z]*"` inside the panel; `npm run verify` and `npm test` green.

8. [ ] Add the weighting engine to both files
   - Files: `index.html` (a second IIFE after the existing one, i.e. after line
     2134 `})();` and before `</script>`), `index.en.html` (same position),
     `scripts/lib/rubric.mjs` (new)
   - Sentinels, nested exactly like this so drift is testable:
     `/* wt-engine:begin */`, then
     `/* wt-strings:begin */ var T = {…}; /* wt-strings:end */`, then
     `/* wt-formula:begin */ … /* wt-formula:end */`, then the rest of the code,
     then `/* wt-engine:end */`. Everything inside `wt-engine` and outside
     `wt-strings` is byte-identical between the two pages.
     `scripts/lib/rubric.mjs` contains the **same bytes** between its own
     `/* wt-formula:begin */` / `/* wt-formula:end */` markers, with its
     `export` statement outside them — so the formula block must be plain
     shared-syntax function declarations (`var`, no `export`, no module scope,
     no DOM).
   - Behaviour:
     - `defaults()` reads `.method-table tr[data-dim]` → `{dim: Number(td.w)}`.
     - `tools()` reads `.score-card[data-tool]` → name from `.score-tool a`,
       `published` from `.score-number` (null when absent), `{raw, max}` per
       `.score-dims .dim[data-dim]` (`raw = null` when the attribute is absent),
       and the unrated reason from the `.dim.is-unevidenced` row's
       `data-reason`. **The reason is never hardcoded per tool in `T`** — that
       would be a fourth, unverified copy of a finding that already exists in
       `tools.json`, in the card, and in `verify`.
     - Formula block (`wt-formula`): `S = Σ w`; if `S === 0` return `null`; if
       any `raw === null` return `null` (unrated wins over every weighting — see
       ADR-006); else `Math.floor(Σ ((100 * w[d] / S) * raw[d] / max[d]) + 0.5)`.
       One rounding, half-up, on the total only, at **full precision** — the
       2-dp display rounding (D4) must not appear anywhere in the engine.
     - Render: rated tools sorted by recomputed total descending; ties keep
       score-grid DOM order and share a rank number; each row shows the name, the
       recomputed total (`aria-label` prefixed with `T.yours`), the published
       total (prefixed with `T.published`), and a `wt-bar-fill` width equal to
       the recomputed total. Unrated tools render into `#wt-unrated` under
       `T.unratedHead` with the reason read from the card, never a total.
     - `S === 0`: `#wt-ranking` shows `T.allZero` only — no rows, no `NaN`.
     - Presets, **two only**: `published` = the Methodology-table weights;
       `equal` = every weight `17` (a mid-track value on the 0–50 slider that
       normalises to 16.67% each — at `1` all six handles would park at the far
       left while the readout said 16.7%). `aria-pressed` compares the
       **normalised** weight vectors, not raw slider values, so `17,17,17,17,17,17`
       and `20,20,20,20,20,20` both read as `equal`.
     - Events: render on `input` (live), persist to `localStorage` on `change`
       (a drag otherwise fires ~100 synchronous `setItem` calls per second).
     - Persistence: `localStorage['aiab.dimension-weights.v1']` =
       `{"v":1,"w":{…}}`. On load: if the key is missing, unparseable, `v !== 1`,
       missing a dimension, or holds anything that is not an integer in
       `[0, 50]`, ignore it silently and use the published defaults — do **not**
       delete it (a future schema's data is not this page's to destroy). Reset
       applies the published defaults *and* `removeItem`s the key.
     - Last line of init: `panel.hidden = false`.
   - Done when: `npm run verify` and `npm test` green; `git diff` shows no change
     to any `.score-number`, `score-bar-fill` width, `.dim` figure or
     `data/tools.json`; and in both languages with empty storage, all eleven
     rated totals in the panel equal the published card numbers
     (83/81/87/87/73/76/83/83/76/66/51), `manus-ai` appears only under
     "not rated" with the reason taken from its card, one slider moves the panel
     and nothing else, reload keeps the moved weights, and Reset restores the
     eleven published totals and bar widths and empties the storage key.

9. [ ] Guard the invariants the panel could silently break, and teach the apply line about them
   - Files: `scripts/verify.test.mjs` (or a new `scripts/panel.test.mjs` —
     `npm test` runs the whole `scripts/` directory),
     `.github/workflows/apply.yml`
   - Tests:
     - **occurrence counts over the whole `parseScores` slice**, in both files:
       `score-number` × 11, `score-bar-fill` × 11, `score-descriptor` × 12,
       `<div class="score-card` × 12, `<details class="score-dims">` × 12,
       `<div class="dim` × 72. This covers anything a future editor drops
       between the grid's close and the panel comment, which a panel-only
       negative match would miss entirely;
     - the panel slice (`sliceBetween(html, '<!-- Weighting Panel -->',
       '<!-- Feature Matrix -->')`) matches none of the five reserved strings —
       kept as a cheap, fast-failing extra check;
     - `parseScores(html).size === 12`, `manus-ai` unrated **and its descriptor
       still `Autonomous Web Agent`** in both files (extend the existing test at
       `verify.test.mjs:151`), so panel bleed-through is caught;
     - byte-identity across all three copies of the formula: the
       `wt-formula` block in `index.html`, in `index.en.html`, and in
       `scripts/lib/rubric.mjs`;
     - the `wt-engine` slices of the two pages are byte-identical once each
       file's `wt-strings` span is removed;
     - recomputing from the *parsed HTML* (`parseDimensions` raw/max +
       `parseWeights` weights, normalised, one half-up rounding at full
       precision, via `scripts/lib/rubric.mjs`) reproduces `score.value` for all
       eleven rated tools in both files — card 2's first acceptance criterion,
       machine-checked;
     - the same recompute with `maturity` weight 0 still yields no total for
       `manus-ai`.
   - `.github/workflows/apply.yml`, prompt edits:
     - item 1 (line 107): add the dimension figures — "every changed score,
       score-bar width, **rubric dimension figure (`data-raw`, `data-max`, the
       `dim-raw` text and the rounded `dim-points` text)**, matrix chip state and
       label, and price field";
     - add an explicit rated↔unrated transition instruction: when a tool gains
       or loses tier-A maturity evidence, the card's `is-unrated` class,
       `score-number` + `score-bar-fill` vs `score-unrated`, and the maturity
       row's `dim is-unevidenced` class, presence or absence of `data-raw`, the
       `—` / `nicht belegt` | `not evidenced` text and the `data-reason` /
       `title` all have to move together. None of that is a "changed figure", so
       without this the apply agent lands red on the first such round;
     - lines 117–120: extend "address every cell by its `data-tool` /
       `data-feature` attribute — never count columns" to include `data-dim`.
   - Done when: `npm test` green with the new tests; each new test fails when its
     own assertion is inverted; the apply prompt names dimension figures, the
     rated↔unrated transition and `data-dim`.

10. [ ] Record the decision as ADR-006
   - Files: `docs/decisions/006-reweighting-is-a-view.md` (new)
   - Follow `docs/decisions/000-template.md`. **Decision:** user reweighting is a
     **view**; the published rubric (ADR-005) is the **rating**. The rules that
     keep them apart: the published grid never moves, re-orders or re-renders;
     every adjusted figure is labelled as the visitor's own weighting in both
     languages; the weighting lives in `localStorage` only — no URL parameter,
     no `?w=` encoding, no shareable link, so the site never transmits or encodes
     a reweighted number and one cannot be handed to a third party wearing the
     site's authority; the two presets are the published weights and equal
     weights, both stated and reproducible, never named verdicts (CLAUDE.md rule
     3); nothing outside the six rubric dimensions is weightable; badges,
     descriptors, the Verdict section, the Methodology table and the pricing and
     matrix sections are inert to visitor weights. **Why an unrated tool stays
     unrated at any weighting, including maturity weight 0:** ADR-005's amendment
     makes missing tier-A evidence a *finding*, not a zero, and redistributing
     the weight would measure that tool on a different denominator from every
     other tool — the evidence does not appear because the visitor stopped
     caring about it.
   - **Consequences** must include, beyond the above:
     (a) the reserved-class rule — anything placed between the score grid and
     `<!-- Feature Matrix -->` lands inside the slice `parseScores` reads and
     must avoid `score-number`, `score-bar-fill`, `score-descriptor`,
     `<div class="score-card` and `<div class="dim`; ADR-006 is this rule's only
     durable home, since `PLAN.md` is transient;
     (b) the storage contract — key `aiab.dimension-weights.v1`, schema `{v:1,w}`,
     never transmitted, and the reason no consent artifact is needed: it is a
     functional store holding the visitor's own slider positions, written only by
     their own action, which falls under the ePrivacy Art. 5(3) "explicitly
     requested by the subscriber or user" exemption. Record the reasoning, not
     just the conclusion. Note that DE and EN share the key (same origin);
     (c) that `verify` still does **not** check that a rubric `raw` value follows
     the matrix cells ADR-005 names as its input — the 144 new checks prove the
     pages match `tools.json`, not that `tools.json` matches the matrix, and must
     not be read as proving that link;
     (d) that the display figures are rounded to 2 decimals while every check and
     the engine run on full precision (D4);
     (e) that `scripts/extract.mjs` remains a bootstrap which cannot regenerate
     rubric data, and that a weight change is still an ADR-005 amendment, not
     something the UI can do.
   - Do **not** write any claim about third-party data flow broader than the page
     supports — see the Google Fonts bullet in Risks. Scope the claim to what
     the site does with the weighting, not to what the page as a whole
     transmits.
   - Done when: the file exists, follows the template's four headings, covers
     (a)–(e), and `docs/decisions/` has no gap or duplicate in its numbering.

## Risks & open questions

- **The 144 figures (72 per page) are the biggest mechanical risk.** Mitigation:
  generate them from `data/tools.json`, and land the verifier first (steps 2–3)
  so no unchecked figure ever exists under a green `verify`. The cost is a red
  `npm test` / `npm run verify` between steps 2 and 5, which is stated in the
  ordering note so an implementer following CLAUDE.md's "mark each step done
  immediately" does not try to fix it by weakening an assertion.
- **D7, the decimal separator, is an owner-visible choice**, not a panel
  ruling. `3.33` on the German page is not German convention; the alternative is
  `3,33` on the DE page, which costs a per-language parse in `verify` and drops
  the DE/EN byte-identity check on the figure strings. Flagged for Markus.
- **The `<details>` disclosure means the breakdown is one click away**, not
  on screen. That is owner's call A and the amended acceptance criterion above
  reflects it. It has the side benefit that no card grows by ~90px.
- **The formula exists in three places but is now proven identical** — the
  `wt-formula` block is byte-compared across `index.html`, `index.en.html` and
  `scripts/lib/rubric.mjs` (step 9). What remains untested is everything
  *around* it: the DOM reads, the rendering, the persistence. There is no
  browser test harness and adding one is a dependency and a build step, so those
  are verified by hand below.
- **`manus-ai`'s "not evidenced" reason is prose and `verify` does not check its
  wording.** Precedent: ADR-005 says the same of the provenance note. What
  `verify` does check is the structural fact (no `data-raw` ⇔ JSON `raw` is
  `null`), and step 8 makes the panel read the string from the card rather than
  keep its own copy. The long `rubric.maturity.evidence` string in `tools.json`
  is English-only and full of URLs, so it deliberately does not go on the page.
- **Two presets is a deliberate narrowing** from the four in the first draft.
  An `ops` preset that doubled operability *and* maturity bundled a pairing
  nobody published, and doubling maturity reads as pointed at the one unrated
  tool; a set of "double dimension X" presets also privileges some dimensions
  over others in ways that cut in opposite vendor directions, which is a framing
  choice under CLAUDE.md rule 3. The free sliders reach every one of those
  vectors anyway.
- **Slider range 0–50, integer steps** is a choice, not a constraint. It leaves
  headroom above the largest published weight (25) and keeps the normalised
  percentages legible.
- **Out of scope but worth Markus's attention: `index.html:7` and
  `index.en.html:7` load Inter and JetBrains Mono from `fonts.googleapis.com`,
  which transmits every visitor's IP address to Google with no consent layer.**
  This branch neither causes nor worsens it, and it is not a reason to block
  this work. It does bound what ADR-006 may claim: the ADR may say the site does
  not transmit or encode the *weighting*, and must not say that nothing on the
  page reaches a third party. Recommendation: a separate `/hotfix` to self-host
  the two font files.
- **`scripts/extract.mjs` cannot regenerate the rubric.** It is already a
  one-time bootstrap that destroys sources when re-run; after this change it
  would also destroy the rubric and the dimension markup. Out of scope, flagged
  so nobody runs `npm run extract` expecting a round trip.

## Verification

Machine:
1. `npm test` — green, including the new `parseDimensions` / `parseWeights` /
   dimension-mismatch / occurrence-count / formula-identity / recompute tests.
2. `npm run verify` — prints `OK — index.html, index.en.html and
   data/tools.json agree.` and a source-coverage line whose numbers are
   unchanged from `main` (no data point was added to `tools.json`).
3. Tamper spot-check, then revert: change one `dim-points` digit in
   `index.html`, one `data-raw` in `index.en.html`, one `dim-name` label, and
   one Methodology weight — each must make `npm run verify` fail naming the
   right file, tool and dimension. `git checkout -- index.html index.en.html`
   afterwards.
4. `git diff main --stat` — the only files touched are `index.html`,
   `index.en.html`, `scripts/lib/parse-html.mjs`,
   `scripts/lib/parse-html.test.mjs`, `scripts/lib/rubric.mjs`,
   `scripts/verify.mjs`, `scripts/verify.test.mjs`,
   `.github/workflows/apply.yml`, `docs/decisions/006-*.md`, `PLAN.md`.
   **`data/tools.json` must not appear.**
5. `git diff main -- index.html index.en.html | grep -E '^[-+].*(score-number|score-bar-fill|news-date|topbar-meta)'`
   — must print nothing: no published score, bar width, changelog date or
   as-of stamp moved.

Human, in a browser, for `index.html` **and** `index.en.html` — do both; the
two runs are the sync check no reviewer attention can be delegated:
6. Score overview: every card shows a closed disclosure
   ("Aufschlüsselung der Bewertung" / "Rating breakdown"); opening it shows six
   rows in Methodology-table order with the Methodology labels. Spot-check two
   cards in **display** order: `google-adk` → `18.75 + 20 + 15 + 15 + 15 + 3.33`
   (full precision `…+ 3.3333` = `87.0833`, published `87`), and `maestro` →
   `25 + 10 + 15 + 15 + 7.5 + 10 = 82.5`, the half-up tie, published `83`. The
   displayed figures are rounded and are not expected to reproduce `score.exact`
   to the last digit; the method note says so.
7. `manus-ai`: five figures plus `nicht belegt` / `not evidenced` for release
   maturity, and the card still says "Nicht bewertet" / "Not rated" with no
   number and no bar.
8. Compare: select three tools, open the modal, confirm scores and matrix rows
   render, close, reset.
9. Weighting panel, fresh profile or `localStorage.clear()`: all eleven
   recomputed totals equal the published card numbers; `manus-ai` sits under
   "not rated" with its reason and no total.
10. Drag `operability` to 50: the panel re-orders and its numbers change; the
    score grid above does not move, re-order or change a digit; badges, the
    Verdict section, the Methodology weights, the pricing order and the matrix
    are unchanged.
11. Reload: the moved weight is still there. Press Reset: the published weights,
    the eleven published totals and the bar widths return exactly, and
    `localStorage.getItem('aiab.dimension-weights.v1')` is `null`.
12. Set every slider to 0: a plain sentence appears — no `NaN`, no ranking, no
    zero-scored tools pretending to be ranked.
13. Set `maturity` to 0: `manus-ai` is still unrated, reason shown.
14. Keyboard only: Tab reaches both preset buttons, all six sliders, Reset and
    every `<summary>`; arrow keys move sliders; Space/Enter fires presets, Reset
    and the disclosures; the active preset reports `aria-pressed="true"` and
    clears when a slider moves.
15. Labelling: the panel title, the persistent note and the column headings all
    say the figures are the visitor's own weighting, in the page's language, and
    the published rating stays visible above it.
16. With JavaScript disabled: the published grid renders, every disclosure opens
    and shows its six figures, and the weighting panel is absent — not broken,
    not half-drawn.
