# Agentic workflow — from scheduled research to published site

How the benchmark updates itself: a scheduled, read-only research run
proposes changes, a human approves, coding agents apply them to the served
pages, and a second human merges. Agents never merge, never push to `main`.

![Agentic refresh pipeline: scheduled trigger → research agents → triage →
human gate → apply agent → verify → human gate → GitHub Pages, plus the
/feature and /hotfix coding-agent lines](agentic-workflow.svg)

> The diagram above is a static SVG. If the pipeline changes, update
> `agentic-workflow.svg` alongside the workflow files so the two stay in step.

## The refresh line (the recurring data update)

**1 — Trigger.** [`refresh.yml`](../../.github/workflows/refresh.yml) fires on
a monthly cron (`0 6 1 * *`) or manually via `workflow_dispatch`.

**2 — Research (Phase 1–2, read-only).** After a preflight (API key, round
id) the **research orchestrator** (`claude-opus-5`) dispatches every sub-agent
in one message so they run in parallel:

- **`researcher` × 12** (`claude-sonnet-5`) — one per tool in
  `data/tools.json`, read-only, using WebFetch / WebSearch.
- **`scout` × 1** — sweeps the market for orchestration tools *not* in the
  benchmark and returns radar candidates with evidence.

A transient `is_error` aborts are survived by a single reset-and-retry
(attempt 1 → reset the tree → attempt 2). **Triage** then drops every claim
without a resolvable source URL and keeps only sourced changes.

**3 — Writes.** The round always writes `docs/refresh/<round>-report.md`
(evidence the round ran) and writes `data/tools.json` **only** for sourced
changes — each carrying a `source` URL and a `checked` date. A guard fails
the run if the research phase touched the served HTML.

**4 — Outcome.** `data changed` → a PR labelled `refresh:proposed`
(`verify` is expected to be **red** here — the data no longer matches the
pages); `radar only` → `refresh:radar`; `neither` → no PR, report to the run
summary.

**★ Human gate 1 (Markus).** Reviews the proposal and adds the label
`refresh:approved` — data changes only. That label fires
[`apply.yml`](../../.github/workflows/apply.yml).

**5 — Apply (the coding agent).** After data-only guards, the **apply agent**
(`claude-opus-5`, with per-file sub-agents) writes the approved values into
both `index.html` (DE) and `index.en.html` (EN), adds the changelog entry and
updates the as-of stamp. `npm test` + `npm run verify` must pass before the
update is pushed to the PR branch. This step **does not merge**; `verify` now
turns green.

**★ Human gate 2 (Markus).** Reviews and merges the PR to `main`. On push,
[`verify.yml`](../../.github/workflows/verify.yml) runs green and GitHub Pages
serves the updated `index.html` / `index.en.html`.

See [ADR-003](../decisions/003-refresh-approve-before-merge.md): approve →
apply → verify green → **then** merge. A red `verify` on a `refresh:proposed`
PR means "not yet applied," never "ready to merge."

## The coding-agent lines (`/feature`, `/hotfix`)

Scouted radar candidates are **not** added automatically — adding a tool means
scoring it against every published criterion, which runs through the
**`/feature`** line: `refine` → `planner` (writes `PLAN.md`) → `expert-panel`
→ **★ gate: plan approval** → `implementer` → `reviewer` → **★ gate: merge**.
Only then does a new tool enter `data/tools.json`. The **`/hotfix`** line is
the fast path: investigate → fix → reviewer → one gate (merge). Each phase is
one sub-agent with a clean context; `PLAN.md` is the only shared state between
phases.

## Why the gates and guards

Credibility is the product. No score changes without a verifiable source
(CLAUDE.md rule 1, [ADR-002](../decisions/002-sourcing-applies-to-changes.md)),
and [`scripts/verify.mjs`](../../scripts/verify.mjs) proves that
`data/tools.json` and both HTML files agree
([ADR-001](../decisions/001-json-asserts-html-serves.md)).
