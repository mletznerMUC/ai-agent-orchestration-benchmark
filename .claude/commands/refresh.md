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

## Phase 1a — Research every tool (parallel, read-only)
Read `data/tools.json`. Dispatch one `researcher` subagent **per tool**,
all in the same message so they run concurrently. Give each one its tool
key, its current entry, and its URL.

**Every tool in `data/tools.json`, every round.** Researching a subset
is a debugging shortcut, not a refresh — a round that skips tools leaves
the site claiming things nobody checked.

## Phase 1b — Scout the market (read-only)
In the same message, dispatch one `scout` subagent. It looks for
orchestration tools *not* in `data/tools.json` and returns radar
candidates with evidence.

Scout findings never change `tools.json`. A new tool enters the
benchmark only by being scored against every published criterion, which
is `/feature` work, not a data refresh (CLAUDE.md rule 2). What the
refresh line does is surface the candidate so the decision can be made
deliberately.

Both subagent types have no write tools. Nothing can reach the
repository in this phase — that is deliberate: the hallucination-prone
step must not be able to touch data.

**Run them in the foreground and collect every one of them.** Dispatch
in one message, with the Task tool's background option set to false if
it has one, and do not end your turn while a subagent is still running.
Interactively that only stalls the round; in `refresh.yml` it ends it —
the headless session closes when the orchestrator stops, and every
uncollected subagent is discarded with its work unrecorded. See ADR-008.

## Phase 2 — Triage
Consolidate the reports into a proposed diff against `data/tools.json`
plus a radar section:
- Drop any claim without a resolvable source URL. List what you dropped
  and why — dropped claims are part of the report, not silent losses.
- Group by tool: field, old → new, source, reasoning.
- For score movements, carry the criterion the researcher named. If a
  researcher proposed a score change without naming one, drop it to a
  fact and let the human decide.
- Flag disagreements between sources rather than picking a winner.
- Carry the scout's candidates through with their evidence. Do not
  score them and do not add them to `tools.json`.

**Always write the report, even when nothing changed.** A round that
verified twelve tools and found no movement did real work, and the
record of what was checked is the only evidence of it. "No change
found, checked <date>, sources consulted: …" is a result. Silence is
indistinguishable from a round that never ran.

## GATE 1 — Change approval (STOP)
Present to Markus, compactly:
- the proposed diff grouped by tool,
- dropped and unverified claims,
- any source disagreements,
- radar candidates from the scout, with what each would need before it
  could be benchmarked.

Then STOP and wait. Only an explicit "Go" / "Freigabe" continues.
Never proceed on silence. Do not write `data/tools.json` before this
gate — the proposal lives in your message, not on disk.

Radar candidates are **not** part of what this gate approves. Approving
the data changes does not approve adding a tool; that is a separate
decision and a separate line.

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
