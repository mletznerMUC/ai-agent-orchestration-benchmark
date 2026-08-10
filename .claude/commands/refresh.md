---
description: Run the refresh line — Research → Triage → GATE → Implement → Verify → Review → GATE. The recurring benchmark data update.
---

Run the refresh pipeline. Scope: $ARGUMENTS (default: all tools in
`data/tools.json`).

You are the pipeline orchestrator. You delegate research and
implementation to subagents with clean contexts, and you enforce the
gates. You do not do the phases' work yourself.

This is the third line alongside `/feature` and `/hotfix`. Same rule
holds: **nothing reaches `main` without Markus.**

## Phase 1 — Research (parallel, read-only)
Read `data/tools.json`. Dispatch one `researcher` subagent **per tool**,
all in the same message so they run concurrently. Give each one its tool
key, its current entry, and its URL.

The researchers have no write tools. Nothing can reach the repository in
this phase — that is deliberate: the hallucination-prone step must not
be able to touch data.

## Phase 2 — Triage
Consolidate the reports into a single proposed diff against
`data/tools.json`:
- Drop any claim without a resolvable source URL. List what you dropped
  and why — dropped claims are part of the report, not silent losses.
- Group by tool: field, old → new, source, reasoning.
- For score movements, carry the criterion the researcher named. If a
  researcher proposed a score change without naming one, drop it to a
  fact and let the human decide.
- Flag disagreements between sources rather than picking a winner.

## GATE 1 — Change approval (STOP)
Present to Markus, compactly:
- the proposed diff grouped by tool,
- dropped and unverified claims,
- any source disagreements.

Then STOP and wait. Only an explicit "Go" / "Freigabe" continues.
Never proceed on silence. Do not write `data/tools.json` before this
gate — the proposal lives in your message, not on disk.

## Phase 3 — Implement
On a `refresh/<yyyy-mm>` branch, delegate to the `implementer` subagent
with the approved diff as an inline plan. Order matters:
1. `data/tools.json` — approved values, each with `source` and `checked`
2. `index.html` and `index.en.html` — the same values, both languages
3. a changelog entry in both files
4. the `Stand:` / `As of:` stamp in both files, and `meta.asOf`

## Phase 4 — Verify
Run `npm test && npm run verify`. Both must pass. Failures go back to
the implementer, not to Markus — the verifier exists so the human never
has to check DE/EN consistency by hand.

## Phase 5 — Review
Delegate to the `reviewer` subagent. Focus:
- every changed value traces to a source in `data/tools.json`
- scoring stayed consistent across tools (CLAUDE.md rule 2)
- no promotional language crept in (rule 3)
Draft the PR description.

## GATE 2 — Merge (STOP)
Present the review verdict, the diff summary, and the proposed PR
description. Offer to open the PR. Then STOP.

**Markus merges. You never do.** After the merge: if the round produced
a durable decision, propose an ADR in `docs/decisions/`.
