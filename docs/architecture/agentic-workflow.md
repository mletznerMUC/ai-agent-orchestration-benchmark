# Agentic workflow — from scheduled research to published site

How the benchmark updates itself: a scheduled, read-only research run
proposes changes, a human approves, coding agents apply them to the served
pages, and a second human merges. Agents never merge, never push to `main`.

![Agentic refresh pipeline: scheduled trigger → research agents → triage →
human gate → apply agent → verify → human gate → GitHub Pages, plus the
/feature and /hotfix coding-agent lines](agentic-workflow.svg)

> The diagram above is a static SVG (canonical). A rendered
> [`agentic-workflow.png`](agentic-workflow.png) (2400×3716) is kept alongside
> it for download and for embedding where SVG is not supported. If the pipeline
> changes, update the SVG next to the workflow files and re-export the PNG so
> all three stay in step. Export from a viewport **taller** than the canvas and
> crop back to exactly 2× the SVG's own `width`/`height`: headless Chromium
> leaves the last ~64 px of the viewport unpainted, which is how the previous
> export lost its legend row and footer line without anyone noticing.

## The refresh line (the recurring data update)

**1 — Trigger.** [`refresh.yml`](../../.github/workflows/refresh.yml) fires on
a monthly cron (`0 6 1 * *`) or manually via `workflow_dispatch`.

**2 — Research (Phase 1–2, read-only).** After a preflight (API key, round
id) the **research orchestrator** (`claude-opus-5`) dispatches every sub-agent
in one message so they run in parallel, in the **foreground** — it does not
end its turn while one is still running ([ADR-008](../decisions/008-subagents-run-in-the-foreground.md)):

- **`researcher` × 12** (`claude-sonnet-5`) — one per tool in
  `data/tools.json`, read-only, using WebFetch / WebSearch.
- **`scout` × 1** — sweeps the market for orchestration tools *not* in the
  benchmark and returns radar candidates with evidence.

Whether to retry is decided from **whether the report exists on disk**, never
from the action's exit code: an attempt that failed outright *and* one that
reported success but wrote no report both earn the single reset-and-retry
(attempt 1 → reset the tree → attempt 2). A green exit is evidence that a
program ran, not that the phase did. **Triage** then drops every claim without
a resolvable source URL and keeps only sourced changes.

**3 — Writes.** The round always writes `docs/refresh/<round>-report.md`
(evidence the round ran) and writes `data/tools.json` **only** for sourced
changes — each carrying a `source` URL and a `checked` date. A guard fails
the run if the research phase touched the served HTML.

**4 — Outcome.** Only a **full round** — every tool, plus the scout — may
propose. Any dispatch that narrows the scope (a `tools` filter, or `scout`
off) is a debug round: it still writes, summarises and archives its report,
but creates no branch, no commit and no PR, whatever it found. The round id is
the calendar month, so a narrowed round that proposed would claim the branch
and report filename the month's real round needs, and would carry evidence
that overstates what was checked.

For a full round: `data changed` → a PR labelled `refresh:proposed` (`verify`
is expected to be **red** here — the data no longer matches the pages);
`radar only` → `refresh:radar`; `neither` → no PR, report to the run summary.
The proposal branch `refresh/<round>` is cut from a **freshly fetched**
`origin/main` at the moment it proposes, not from the commit the job checked
out when it started, with only `data/tools.json` and `docs/refresh/` restored
onto it ([ADR-009](../decisions/009-proposal-branch-is-cut-from-current-main.md)).

**★ Human gate 1 (Markus).** Reviews the proposal and adds the label
`refresh:approved` — data changes only. That label fires
[`apply.yml`](../../.github/workflows/apply.yml).

**5 — Apply (the coding agent).** After data-only guards, the **apply agent**
(`claude-opus-5`, with per-file sub-agents) writes the approved values into
both `index.html` (DE) and `index.en.html` (EN), adds the changelog entry and
updates the as-of stamp. `npm test` + `npm run verify` must pass before the
update is pushed to the PR branch, and the commit stages `index.html` and
`index.en.html` **by name** — if the apply step modified any other tracked
file, the run fails and prints the diff rather than sweeping it into a data PR
([ADR-010](../decisions/010-apply-commits-only-the-served-pages.md)). This step
**does not merge**; `verify` now turns green.

**★ Human gate 2 (Markus).** Reviews and merges the PR to `main`. On push,
[`verify.yml`](../../.github/workflows/verify.yml) runs green and GitHub Pages
serves the updated `index.html` / `index.en.html`.

See [ADR-003](../decisions/003-refresh-approve-before-merge.md): approve →
apply → verify green → **then** merge. A red `verify` on a `refresh:proposed`
PR means "not yet applied," never "ready to merge."

## The coding-agent lines (`/feature`, `/hotfix`)

Scouted radar candidates are **not** added automatically — adding a tool means
scoring it against every published criterion, which runs through the
**`/feature`** line: `refine` → `planner` (writes `PLAN.md`) → the expert
panel (`panel-architecture`, `panel-security`, `panel-compliance`, run in
parallel and merged by the orchestrator) → **★ gate: plan approval** →
`implementer` → `reviewer` → **★ gate: merge**.
Only then does a new tool enter `data/tools.json`. The **`/hotfix`** line is
the fast path: investigate → fix → reviewer → one gate (merge). Each phase is
one sub-agent with a clean context — except the panel, which is three, one
per lens (see [ADR-007](../decisions/007-one-model-per-agent.md)); `PLAN.md`
is the only shared state between phases. Each agent pins its own model in
frontmatter.

## Why the gates and guards

Credibility is the product. No score changes without a verifiable source
(CLAUDE.md rule 1, [ADR-002](../decisions/002-sourcing-applies-to-changes.md)),
and [`scripts/verify.mjs`](../../scripts/verify.mjs) proves that
`data/tools.json` and both HTML files agree
([ADR-001](../decisions/001-json-asserts-html-serves.md)).
