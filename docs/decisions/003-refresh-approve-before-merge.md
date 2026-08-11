# ADR-003: A refresh proposal is approved, then applied, then merged — in that order

Date: 2026-08-11
Status: accepted

## Decision
The two gates in the refresh line are **ordered**, not independent. A
`refresh:proposed` PR must first receive the `refresh:approved` label so
`apply.yml` writes the approved data into both HTML pages (plus the
changelog entry and as-of stamp) and turns `verify` green **on the PR**.
Only then is the PR merged. Merging a `refresh:proposed` PR directly —
while `verify` is still red — is a process error, not a shortcut.

## Context
The research phase changes only `data/tools.json`; the served pages are
left untouched by design (ADR-001, ADR-002). So a fresh proposal PR is
*expected* to be red on `verify` — the data no longer matches the pages,
which is exactly what the gate detects.

On the 2026-08 round the proposal (PR #20) was merged straight to `main`
without ever setting `refresh:approved`. `apply.yml` never ran, the pages
were never updated, and `main` landed with `tools.json` ahead of the HTML
— 30 mismatches, `verify` and `npm test` both red on the merge commit.
The red check on the proposal was read as noise to merge past, when it was
the gate doing its job.

Recovery is manual: once the proposal is merged, `apply.yml` (which fires
on the label and pushes to the *proposal* branch) can no longer help, so
the apply has to be redone by hand on a new branch — see PR #21.

## Consequences
- The order is now explicit in `CLAUDE.md`: approve → apply → verify
  green → merge.
- A red `verify` on a `refresh:proposed` PR means "not yet applied," never
  "ready to merge." Treat a red proposal as blocked on the label.
- If a proposal is merged by mistake, main is repaired by re-applying the
  approved `tools.json` to both pages on a fresh branch (matching what
  `apply.yml` would have written), not by reverting the sourced data.
