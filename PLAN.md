# Plan: Add Vercel AI SDK as benchmark tool #13
Branch: feature/vercel-ai-sdk

Tool key (used everywhere, do not vary): `vercel-ai-sdk`.
Evaluation record: `docs/evaluations/vercel-ai-sdk.md` (new).
Hands-on evidence: `docs/hands-on/vercel-ai-sdk/` (new).

**Gate 1 decisions — decided at Gate 1, 2026-10-02** (Markus: "go default and
make it transparent for the user"). All of them are the planner's defaults.
They are settled; no step reopens them:

- **D1 — Scored artefact:** the `ai` package only. Provider packages, AI
  Gateway and the Vercel hosted platform are **not** scored.
- **D2 — Evidence tiers for matrix cells** live in
  `docs/evaluations/vercel-ai-sdk.md` only. **No `tier` field** is added to
  matrix cells in `data/tools.json`.
- **D3 — Tier-C `source` form:** the repo-relative path to the hands-on log
  (e.g. `docs/hands-on/vercel-ai-sdk/2026-10-<dd>-log.md`) — the form this plan
  recommended. The *published pages* link the same artefacts as GitHub blob
  URLs, because a repo-relative `.md` path is not a served page (step 9e).
- **D4 — Directory layout:** `docs/evaluations/` and `docs/hands-on/` stay two
  separate trees, as planned.
- **D5 — As-of stamp** moves to October 2026 / Oktober 2026 in both pages and
  in `meta.asOf`.
- **D6 — Transparency for site visitors** (new requirement set at the gate):
  the published pages must themselves state the scope of what was scored, which
  matrix cells rest on hands-on (tier-C) evidence, and what the October 2026
  stamp does and does not mean. Folded into steps 9 and 10.

All of the above is conditional on step 1: if the category-fit gate stops the
pipeline, none of it applies.

Facts established while planning, which the steps rely on:

- `data/tools.json` → `meta.features` holds exactly **14** criteria:
  `multi-agent-parallel`, `desktop-gui`, `playbooks`, `mobile-remote`,
  `git-worktrees`, `group-chat`, `mcp-support`, `open-source`, `cli-cicd`,
  `observability`, `hitl`, `eu-onprem`, `model-agnostic`, `learning-curve`.
- `scripts/verify.mjs` → `changedWithoutSource` treats *every* field of a new
  tool as changed (`before === undefined`). So for `vercel-ai-sdk` **every**
  data point — all 14 matrix cells, every price row, `score`, and each
  maturity criterion — needs a non-null `source` **and** `checked`.
  `provenance: "legacy-unsourced"` is not available to a new tool.
- Only the `maturity` dimension carries a `criteria` block in the JSON. For
  dimensions 1–4 and 6 the matrix cell **is** the input (ADR-005 rule 2); the
  cell's own `source`/`checked` is its citation. There is no `tier` field on
  matrix cells today, and per **D2** none is added.
- Matrix chips are **positional** inside each `<tr>`; `parseMatrix` throws
  unless chip count equals the number of `<th data-tool>` headers. A 13th
  column means a 13th `<th>` plus one new `<td>` in each of 14 rows, in the
  same ordinal position, in **both** HTML files.
- `meta.toolOrder` is **not** checked by `scripts/verify.mjs`. It drives the
  published order, so it has to be reconciled against the markup by reading
  the files, not by running a script.
- Hardcoded counts that will break `npm test`:
  `scripts/lib/parse-html.test.mjs` (`TOOL_KEYS` list, `12`, `14`, `168`,
  `72`), `scripts/panel.test.mjs` (`score-number` 11, `score-bar-fill` 11,
  `score-descriptor` 12, `<div class="score-card` 12,
  `<details class="score-dims">` 12, `<div class="dim` 72, `scores.size` 12),
  `scripts/verify.test.mjs` (`72` dimension rows).
  The 11/11 pair in `panel.test.mjs` is 12 cards minus the one unrated card.
- **Where transparency prose can safely go** (it must not disturb the
  parsers/count tests): the parsers slice the score grid between
  `<div class="score-grid">` and `<!-- Feature Matrix -->`, the matrix between
  `<!-- Feature Matrix -->` and `<!-- Pricing -->`, pricing between
  `<!-- Pricing -->` and `<!-- Verdict -->`. Any added prose must therefore
  contain **none** of the substrings `<div class="score-card`,
  `<div class="dim`, `<div class="score-number">`, `<th data-tool=`,
  `<span class="chip chip-`, `<span class="price-row-label">` — those are what
  the regexes and the hardcoded counts key on. A `<p class="method-note">`
  (style already defined at `index.html:630`, used at `index.html:2227`) placed
  *after* `</table></div>` of a section is safe. External links already exist
  in the page body with the `target="_blank" rel="noopener"` pattern, incl. a
  `github.com` link (`index.html:1560`), so linking out adds no new origin
  as a subresource and no dependency.
- `verify` requires `meta.asOf === newest <span class="news-date">` in both
  files. Today is 2026-10-02 and the page says "September 2026" / "Stand:
  September 2026", so a new changelog entry forces the as-of stamp to move
  (**D5**).
- The hero `<div class="stat-num">12</div>` (index.html:1391 and its EN twin)
  is not verified mechanically but is published and must move to 13.
- Root `package.json` has **no** dependencies and CI installs nothing
  (`.github/workflows/verify.yml` says "No dependencies by design"). That
  must stay true. The root test glob is `scripts/**/*.test.mjs`.
- There is no `.gitignore` in the repo.
- `docs/decisions/` runs 000–011, so **012** is the next free ADR number.
  Confirm it is still free when step 6 runs.

## Steps

1. [x] **Category-fit gate (STOP condition).** — PASS on all four bars; the
   in-category bar clears on the documented `ToolLoopAgent` multi-step tool
   loop and the documented subagent delegation pattern. Pipeline continues. Check Vercel AI SDK against the
   four scout bars (`.claude/agents/scout.md`): in category / real and usable
   / alive / non-trivial signal, each with a URL actually read. Record the
   verdict and the sources. If the **in-category** bar fails, write that
   finding, stop the pipeline, change no data and report the outcome — steps
   2–11 do not run, and the Gate 1 decisions D1–D6 fall with them. Be explicit
   about the question that makes this a gate: the AI SDK is a
   provider-abstraction + tool-calling + agent SDK, and the bar asks for
   planning, delegation, multi-step tool use, or multi-agent coordination.
   Cite the specific documented capability that clears it, or record that none
   does.
   - Files: `docs/evaluations/vercel-ai-sdk.md` (new, section "Category fit")
   - Done when: the file states pass/fail per bar with one source URL and a
     checked date each, and an explicit overall verdict sentence; on fail, no
     other file in the repo has been touched.

2. [ ] **Pin the version baseline, the scored artefact and the as-of date.**
   Record the latest stable release tag on the day of evaluation (from the
   GitHub releases page and/or the npm registry version for the `ai` package —
   name which one is authoritative for the pin) and the `checked` date used
   throughout. This single date is reused as `checked` on every data point
   added later. Restate **D1** verbatim as the scope of this evaluation: the
   `ai` package only, with provider packages, AI Gateway and the Vercel hosted
   platform explicitly out of scope — this is the wording the pages reuse in
   step 9e, so write it once here in both DE and EN.
   - Files: `docs/evaluations/vercel-ai-sdk.md` (section "Version baseline")
   - Done when: the file names the exact tag/version string, the URL it was
     read from, the evaluation date, states that this date is the `checked`
     value for every citation in this feature, and carries the D1 scope
     sentence in DE and EN marked as "decided at Gate 1, 2026-10-02".

3. [ ] **Score the 14 matrix criteria from official docs.** One row per
   criterion in a table: state (`yes`/`partial`/`no`), the DE and EN chip
   label, source URL, checked date, evidence tier (A/B/C), and one sentence of
   justification. Tiers live here and nowhere else (**D2**). Apply the
   published tier tests where they exist — `model-agnostic` uses the ADR-005
   2026-09-02 amendment table (what the operator can choose, not how the tool
   reaches the model). Judge every criterion against the D1 artefact only.
   Vendor blog, marketing and roadmap pages are not evidence; a roadmap may
   only justify `partial` with a "Planned"-style label in words. Mark any
   criterion that cannot be settled from docs as **`pending hands-on`** — that
   list is the input to step 4. Also collect the pricing facts for the price
   card (type, main, note, rows) with a source and checked date per row.
   - Files: `docs/evaluations/vercel-ai-sdk.md` (sections "Matrix" and
     "Pricing")
   - Done when: each of the 14 criteria either has a state with a source URL,
     a checked date and a tier, or is explicitly marked `pending hands-on`;
     the `pending hands-on` list is written down as a list even if it is
     empty; every price row has a value, a source URL and a checked date.

4. [ ] **Hands-on reproducer script (only if step 3 left a criterion
   `pending hands-on` / heading for tier-C; otherwise mark done and record
   "no tier-C evidence needed").** A standalone Node script that exercises the
   specific capability in question and prints what it observed.
   - It lives in `docs/hands-on/vercel-ai-sdk/` (**D4**: separate from
     `docs/evaluations/`) with its **own** `package.json` + committed
     `package-lock.json` pinning the exact `ai` version from step 2 (exact
     version, no `^`). The root `package.json` stays dependency-free and
     unchanged.
   - **Non-goal, stated explicitly:** nothing under `docs/hands-on/` is ever
     referenced by the root `package.json`, by any file in `scripts/`, or by
     any workflow. It is reproduction evidence, not part of the site or its
     checks. As defence-in-depth on top of that boundary, no file in it is
     named `*.test.mjs` — the root test glob is `scripts/**/*.test.mjs` and
     cannot reach `docs/` anyway, so the naming rule is a second line, not the
     mechanism.
   - **Default run is against a mock/local model**, so it needs no provider
     account and no network. First choice: the AI SDK's own test/mock model
     utilities if the pinned version documents them (verify in the docs — do
     not assume the import path). Fallback: a tiny local HTTP stub serving an
     OpenAI-compatible chat-completions endpoint from Node's built-in `http`,
     with `baseURL` pointed at `http://127.0.0.1:<port>` and a dummy key.
   - **No secrets anywhere.** Any real-provider mode is opt-in via an
     environment variable read with `process.env`, never a flag value, never a
     committed file. The script must not print environment variables or
     request headers, and the log must contain no key material. Add a
     `.gitignore` (new file) ignoring `node_modules/` so an install cannot be
     committed.
   - Files: `docs/hands-on/vercel-ai-sdk/run.mjs`,
     `docs/hands-on/vercel-ai-sdk/package.json`,
     `docs/hands-on/vercel-ai-sdk/package-lock.json`, `.gitignore` (new)
   - Done when: `cd docs/hands-on/vercel-ai-sdk && npm ci && node run.mjs`
     completes offline with no credentials set and prints an observation that
     answers the criterion; `npm test` and `npm run verify` at the repo root
     still behave exactly as before (nothing installed at the root); `grep -r`
     for `hands-on` in `package.json`, `scripts/` and `.github/workflows/`
     returns nothing.

5. [ ] **Hands-on log (same condition as step 4).** A written record: version
   tested, date, exact commands and inputs, verbatim observed output, and the
   criterion each observation decides. One section per tier-C criterion,
   ending in the state it supports. The log does **not** define its own format
   rules in its header; it cites `docs/decisions/012-hands-on-evidence.md`
   (written in step 6) as the source of the format. Per **D3**, this file's
   repo-relative path is the `source` value every tier-C data point carries;
   note its GitHub blob URL too — step 9e links it from the pages.
   - Files: `docs/hands-on/vercel-ai-sdk/2026-10-<dd>-log.md`
   - Done when: a second person could reproduce every observation from the log
     alone; each tier-C matrix row in `docs/evaluations/vercel-ai-sdk.md`
     points at this file as its source; the log's header links the ADR instead
     of restating format rules.

6. [ ] **Record the hands-on evidence precedent as an ADR.** Write
   `docs/decisions/012-hands-on-evidence.md` (confirm 012 is still the next
   free number in `docs/decisions/` before writing). It records the Gate 1
   decisions, not new ones. Each is written as **decided at Gate 1,
   2026-10-02**, with these values:
   - **D1** the scored artefact is the `ai` package only — providers, AI
     Gateway and the Vercel platform are out of scope;
   - **D4** hands-on artefacts live in `docs/hands-on/<tool>/`, kept as a tree
     separate from `docs/evaluations/<tool>.md`, plus the log format;
   - **D3** the form `source` takes for a tier-C data point: the repo-relative
     path to the log file (published pages link the GitHub blob URL instead,
     because a `.md` path is not a served page);
   - **D2** matrix cells carry **no** `tier` field — tiers live in the
     evaluation doc, per ADR-005 Consequences;
   - **D6** the published-page transparency requirement (scope, tier-C cells,
     as-of meaning) as a standing expectation for future additions;
   - the non-goal from step 4: nothing under `docs/hands-on/` is wired into the
     root package, `scripts/` or any workflow.
   Follow `docs/decisions/000-template.md`.
   - Files: `docs/decisions/012-hands-on-evidence.md` (new)
   - Done when: the file exists with Date/Status/Decision/Context/Consequences
     sections, states each of D1–D4 and D6 as decided at Gate 1 on 2026-10-02,
     and step 5's log links to it; no other ADR is edited.

7. [ ] **Derive the six rubric dimensions and the arithmetic.** Map the matrix
   results onto the ADR-005 dimensions (orchestration 25/max 8, operability
   20/4, integration 15/6, sovereignty 15/4, maturity 15/6, accessibility
   10/6), scoring each criterion 0/1/2. Maturity is **tier A only**, from
   tagged releases or a dated vendor GA statement for the D1 artefact, against
   the ADR-005 amendment table (`ga-status`, `release-recency` ≤30/31–90/>90
   days, `sustained-cadence` ≥6/2–5/≤1 stable releases in the trailing 90 days
   from the step-2 date). If any maturity criterion has no tier-A source, the
   tool is **unrated**: `score.value = null`, `score.exact = null`,
   `maturity.points = null`, `maturity.raw = null`, `criteria: null`, with the
   reason in `maturity.evidence` — never 0. Otherwise compute
   `points = weight*raw/max` per dimension, `exact` as the unrounded sum, and
   `value = floor(exact + 0.5)`.
   - Files: `docs/evaluations/vercel-ai-sdk.md` (section "Rubric")
   - Done when: **no criterion in the step-3 matrix table is still marked
     `pending hands-on`** — each one has been settled either from docs or by
     the step-5 log; and the file shows per-dimension raw/max/points, the
     trailing 90-day release list behind `sustained-cadence`, the exact total
     and the rounded value (or an explicit unrated verdict with its reason),
     and the arithmetic checks by hand.

8. [ ] **Add the tool to `data/tools.json`.** Append a `vercel-ai-sdk` entry
   after `manus-ai` with `name`, `score` (value/source/checked/provenance/
   exact/rubric, `maturity.criteria` tiered as in step 7), `descriptor`
   (de/en), all 14 `matrix` cells and the `price` block — every data point
   carrying the step-2 `checked` date and a real source (a URL, or for tier-C
   the repo-relative log path per **D3**), `provenance: "sourced"`. **No `tier`
   field on any matrix cell** (**D2**). **Do not touch `meta.toolOrder` here** —
   that happens in step 9, once the markup exists. Do not touch any existing
   tool.
   - Files: `data/tools.json`
   - Done when: `node -e "JSON.parse(require('fs').readFileSync('data/tools.json'))"`
     passes; `grep -c '"provenance": "legacy-unsourced"'` is unchanged from
     `main`; no `"tier"` key appears under the new tool's `matrix`;
     `node scripts/verify.mjs` fails *only* with "missing tools
     vercel-ai-sdk" style messages (the pages have not been edited yet) and
     with no `rubric:` or `sourcing:` failures.

9. [ ] **Add the tool to both served pages with its scope and evidence
   disclosure, then reconcile `meta.toolOrder`.** In `index.html` and
   `index.en.html`, mirroring the existing markup exactly and keeping the two
   files identical in content (DE/EN wording only), neutral and descriptive,
   plain HTML/CSS, **no new dependency and no new external subresource**:
   (a) a `<div class="score-card" data-tool="vercel-ai-sdk">` with link,
   score-number + bar (or `is-unrated` with `score-unrated` and **no**
   number/bar), descriptor, and six `<div class="dim">` rows in Methodology
   order (orchestration, operability, integration, sovereignty, maturity,
   accessibility) with `data-max`, `data-raw`, `dim-name` + identical `title`,
   `dim-raw` `raw/max`, `dim-points` rounded to 2dp with a **dot** in both
   languages; an unevidenced maturity row copies the `is-unevidenced` /
   `data-reason` pattern used by `manus-ai`;
   (b) a 13th `<th data-tool="vercel-ai-sdk">` and one new `<td><span
   class="chip chip-…">` in **all 14** matrix rows, at the same ordinal
   position in both files;
   (c) a `<div class="price-card" data-tool="vercel-ai-sdk">` with
   price-tool / price-type / price-main / price-note and the price rows and
   tones from step 3;
   (d) **transparency note (D6)**, one `<p class="method-note">` added directly
   after the matrix table's closing `</table></div>`, inside the Feature-Matrix
   section and before `<!-- Pricing -->`, reusing the existing
   `.method-note` style (defined `index.html:630`, used at `index.html:2227`) —
   no new CSS class, no new component. It states, in the D1 wording written in
   step 2: that for Vercel AI SDK the scored artefact is the `ai` package only
   and that provider packages, AI Gateway and the Vercel platform are not
   scored; the exact version evaluated and the as-of/checked date from step 2;
   which matrix criteria rest on hands-on (tier-C) evidence, named by their
   published row labels, with two `target="_blank" rel="noopener"` links — one
   to the hands-on log and one to the reproducer script, as GitHub blob URLs
   (**D3**: `source` in the JSON stays the repo-relative path). If step 4/5 did
   not run, the sentence instead reads that all cells rest on vendor
   documentation and the two links are omitted.
   **This adds no field that `verify` or the tests read**: it introduces no
   `data-tool`, `chip`, `score-card`, `dim`, `price-row-*` or `news-date`
   markup, and must contain none of those substrings (see the placement fact
   above). If an implementer finds they cannot phrase it without one, stop and
   raise it rather than changing a parser.
   (e) only after (a)–(d) are written, add `vercel-ai-sdk` to the three
   `meta.toolOrder` arrays in `data/tools.json` at the position the markup
   actually uses.
   Land this together with step 10 as one commit.
   - Files: `index.html`, `index.en.html`, `data/tools.json`
   - Done when: `node scripts/verify.mjs` prints
     "OK — index.html, index.en.html and data/tools.json agree."; `npm test`
     count assertions are unaffected by (d); the DE and EN notes say the same
     things in the same order; both links resolve to files that exist on the
     branch; **and** the three `meta.toolOrder` arrays match the `data-tool`
     order actually written into `index.html` (score grid, matrix headers,
     price cards), verified by reading the file — `scripts/verify.mjs` does not
     check `toolOrder`.

10. [ ] **Update the published counts, the changelog entry (incl. the as-of
    disclosure) and the as-of stamp.** Hero `stat-num` 12 → 13 in both files.
    Add a changelog entry (`news-date` "Oktober 2026" / "October 2026")
    describing the addition in descriptive, non-promotional language, using the
    existing `news-card` / `news-intro` / `news-list` markup, and naming:
    the version pinned in step 2; the D1 scope (`ai` package only — providers,
    AI Gateway and the Vercel platform not scored); that some cells rest on
    hands-on evidence, with the same two links as step 9d (omit if steps 4–5
    did not run); and, per **D6**, one sentence stating that the October 2026
    stamp reflects **this addition only** and that the other twelve tools were
    last checked at their own `checked` dates and were **not** re-verified in
    this change. Move `topbar-meta` to "Stand: Oktober 2026" / "As of: October
    2026" and `meta.asOf` in `data/tools.json` to match (**D5**), since
    `verify` requires as-of to equal the newest news date. Update the hardcoded
    counts in `scripts/lib/parse-html.test.mjs` (add `vercel-ai-sdk` to
    `TOOL_KEYS`; 12→13, 168→182, 72→78), `scripts/panel.test.mjs` (card counts
    12→13, `<div class="dim` 72→78, and `score-number`/`score-bar-fill` 11→12
    **only if** the new tool is rated — leave at 11 if it is unrated) and
    `scripts/verify.test.mjs` (72→78). Do not change the existing changelog
    entries or any existing tool's wording, and do not touch any other tool's
    `checked` date.
    - Files: `index.html`, `index.en.html`, `data/tools.json`,
      `scripts/lib/parse-html.test.mjs`, `scripts/panel.test.mjs`,
      `scripts/verify.test.mjs`
    - Done when: `npm test` and `npm run verify` both pass; the new entry is
      the only one with an October 2026 `news-date`; the as-of disclosure
      sentence is present and identical in content in both languages;
      `git diff main -- data/tools.json` shows no `checked` date changed on any
      existing tool.

11. [ ] **Commit and self-check against the acceptance criteria.** One or two
    conventional commits: a `data:` commit for `data/tools.json` + both pages
    + the evaluation record, with every source URL referenced in the body, and
    (if steps 4–6 ran) a `docs:` commit for the hands-on script, the hands-on
    log and `docs/decisions/012-hands-on-evidence.md`. Then confirm with
    `git diff main -- data/tools.json` that no existing tool's score, ranking,
    matrix cell, label or price moved. Do not merge, do not push to `main`,
    do not tag.
    - Files: git history only
    - Done when: `npm test` and `npm run verify` pass on the branch tip;
      `git diff main -- data/tools.json` shows only additions inside
      `meta.toolOrder`, `meta.asOf` and the new `vercel-ai-sdk` object; the
      `docs:` commit contains the ADR; the commit bodies list the sources;
      the D6 disclosures from steps 9d and 10 are visible on both pages.

## Risks & open questions

- **Category fit is genuinely open.** The AI SDK is widely used as a provider
  abstraction and UI streaming layer, which is not orchestration. Whether it
  clears bar 1 depends on what the current docs document as agent/loop/
  multi-step-tool-use capability. Step 1 is a real gate, not a formality, and
  the honest outcome may be "radar candidate, not benchmark entry". No scoring
  work should start before it resolves. If it fails, D1–D6 never take effect.
- **Scope of the tool as evaluated — decided at Gate 1, 2026-10-02 (D1):** the
  `ai` package only. Residual risk, not an open question: the `ai` package
  alone answers `eu-onprem`, `observability` and pricing differently from
  "AI SDK + Gateway + Vercel platform", and a reader who thinks of the whole
  stack may read the scores as lower than they expect. That is exactly what the
  step 9d and step 10 disclosures are for; if a criterion cannot be answered
  for the package in isolation, record that in the evaluation doc rather than
  quietly widening the scope.
- **Matrix cells carry no `tier` field — decided at Gate 1, 2026-10-02 (D2).**
  Residual risk: tier-C evidence is then not machine-readable in
  `data/tools.json`; it is discoverable only via the evaluation doc and the
  page note. Accepted for this feature, and recorded in ADR-012.
- **Tier-C `source` is a repo path, not a URL — decided at Gate 1, 2026-10-02
  (D3).** `verify` only checks truthiness, so the repo-relative path passes.
  Residual risk: the path is not clickable from the served page, which is why
  the pages link GitHub blob URLs instead; those URLs are branch/path-sensitive
  and will need updating if the log is ever moved or renamed.
- **`docs/evaluations/` and `docs/hands-on/` stay separate — decided at
  Gate 1, 2026-10-02 (D4).** The merge into one per-tool tree stays a possible
  later simplification; not acted on here.
- **The hands-on script needs a model.** The plan defaults to a mock/local
  model so the check runs offline with no credentials. A mock proves a
  mechanism exists (the SDK performs a multi-step loop, calls a tool, pauses
  for approval) but cannot evidence model-dependent behaviour. If a criterion
  genuinely needs a real provider, say so in the log, run it with a key from
  an environment variable, and record that the offline path reproduces only
  the mechanism. Never commit a key; never print one.
- **Pinning in a nested `package.json` is still a dependency in the repo.**
  Gate 1's "go default" keeps the planner's default: a nested, pinned
  `package.json` under `docs/hands-on/`, wired into nothing. It adds no build
  step and nothing to the root install or to CI, but it is the first
  `node_modules` the repo can produce. Residual risk against CLAUDE.md rule 4;
  flagged, not re-opened.
- **Pricing is in scope by necessity.** The task card does not mention the
  price card, but `verify` fails without one, and every price row needs a
  source. If Vercel publishes no list price for the artefact being scored,
  the row must say so in words with the pricing page as its source.
- **As-of stamp moves to October 2026 — decided at Gate 1, 2026-10-02 (D5).**
  Residual risk: the stamp is site-wide, so moving it makes the whole page
  claim October currency while twelve of thirteen tools were last checked
  earlier. The step-10 changelog sentence (D6) is the mitigation; it is prose,
  not a mechanism, and nothing enforces that it stays accurate next round.
- **Transparency prose is unverified by machine.** The D6 notes in steps 9d and
  10 are plain text: no test asserts their presence or their accuracy, and
  nothing stops them going stale when the version or the evidence changes. The
  reviewer has to read them. Deliberately so — adding a parser for them would
  be build-step creep.
- **A rated 13th tool reorders the published grid.** Score cards are laid out
  in rank order. Inserting the new card in rank position changes no existing
  tool's score or rating but does change the visual ranking around it. Step 9
  should place it by score; if it is unrated, it goes with `manus-ai` at the
  end. `meta.toolOrder` is not machine-checked, so that reconciliation is a
  read-the-file check, not a script.
- **No `.gitignore` exists today.** Adding one is a new repo-wide file; keep
  it to `node_modules/` and say so in the commit.
- **Eleven steps, one over the soft cap.** The ADR step is additive and small;
  if the gate prefers ten, it folds into step 11's `docs:` commit — but then
  the precedent is recorded after the evidence it governs, which is why it is
  its own step here.

## Verification

- `npm run verify` prints "OK — index.html, index.en.html and data/tools.json
  agree." and the source-coverage line shows the legacy-unsourced count
  unchanged from `main` (the new tool adds only sourced points).
- `npm test` passes, with the updated counts 13 / 182 / 78.
- Read the three `meta.toolOrder` arrays against the `data-tool` order in
  `index.html` (score grid, matrix headers, price cards) — they must match
  position for position; nothing checks this mechanically.
- Open `index.html` and `index.en.html` in a browser: 13 score cards, hero
  stat reads 13, the matrix has 13 data columns and every one of the 14 rows
  has 13 chips, 13 price cards, and the new changelog entry at the top with
  the as-of stamp matching it.
- **Transparency (D6), read as a visitor, in both languages:** below the
  feature matrix, a note names the scored artefact as the `ai` package only,
  says providers / AI Gateway / the Vercel platform are not scored, gives the
  exact version and the as-of date, and names the matrix rows that rest on
  hands-on evidence. Its two links open the hands-on log and the reproducer
  script. The October 2026 changelog entry says the stamp reflects this
  addition and that the other twelve tools were last checked at their own
  `checked` dates. DE and EN say the same things; the wording is descriptive,
  with no promotional or disparaging phrasing. View source: no new CSS class,
  no new script, no new external subresource.
- Expand the new card's "Aufschlüsselung der Bewertung": six dimensions in
  Methodology order; the six figures sum to `score.exact` and round to the
  published number — or the maturity row reads "nicht belegt" / "not
  evidenced" and the card shows no number and no bar.
- Open the weighting panel, move the sliders: the new tool re-ranks like the
  others; if unrated it stays in the unrated list at every weighting,
  including maturity at 0.
- Cross-check each of the 14 matrix cells and each price row against the URL
  cited in `docs/evaluations/vercel-ai-sdk.md`, and each maturity criterion
  against the releases page, for the pinned version and date. Every claim must
  hold for the `ai` package alone. No criterion in that doc may still read
  `pending hands-on`.
- Confirm no matrix cell in `data/tools.json` carries a `tier` key (D2), and
  that every tier-C `source` is the repo-relative log path (D3).
- Reproduce the hands-on check: `cd docs/hands-on/vercel-ai-sdk && npm ci &&
  node run.mjs` with no credentials in the environment; the output matches
  the log. Grep the log and the script for anything key-shaped; there must be
  none. Confirm `docs/hands-on/` is referenced nowhere in the root
  `package.json`, `scripts/` or `.github/workflows/`.
- `docs/decisions/012-hands-on-evidence.md` exists, records D1–D4 and D6 as
  decided at Gate 1 on 2026-10-02, and matches what the feature actually did:
  scored artefact, artefact location, log format, `source` form for tier-C,
  no `tier` field on matrix cells, and the published-page disclosure.
- `git diff main -- data/tools.json index.html index.en.html` contains no
  modification to any other tool's score, chip, label, price or `checked`
  date.
