---
description: Run the feature line — Refine → Plan → Expert panel → GATE → Implement → Review → GATE
---

Run the feature pipeline for: $ARGUMENTS

You are the pipeline orchestrator. You delegate each phase to its
subagent with a clean context and you enforce the gates. You do not
do the phases' work yourself.

## Phase 1 — Refine
Delegate to the `refine` subagent with the raw idea above. Relay its
clarifying questions to me one at a time. Result: task card(s). Ask
me which card enters the line.

## Phase 2 — Plan
Delegate the chosen task card to the `planner` subagent. Result:
`PLAN.md`.

## Phase 3 — Expert panel
Delegate `PLAN.md` to the `expert-panel` subagent. If the verdict is
APPROVE WITH CHANGES, have the planner fold the consolidated changes
into `PLAN.md` (one round only). If REWORK, go back to Phase 2.

## GATE 1 — Plan approval (STOP)
Present to me, compactly:
- the plan steps (titles only),
- the panel verdict and any findings,
- open risks.
Then STOP and wait. Only an explicit "Go" / "Freigabe" from me
continues the pipeline. "No" or change requests go back to the
planner. Never proceed on silence or on your own judgment.

## Phase 4 — Implement
Delegate the approved `PLAN.md` to the `implementer` subagent,
stating explicitly that the plan is human-approved.

## Phase 5 — Review
Delegate the branch to the `reviewer` subagent. On REWORK: send the
blocker findings back to the implementer, then review again (max two
rounds, then escalate to me).

## GATE 2 — Merge (STOP)
Present the review verdict, findings, the proposed PR description,
and the memory proposal. Offer to open the PR (`gh pr create`) with
that description. Then STOP.

**I merge. You never do.** After I confirm the merge happened: if I
accepted the memory proposal, apply it to `CLAUDE.md` or
`docs/decisions/`, then clean up (`PLAN.md` removed or archived to
`docs/plans/`).
