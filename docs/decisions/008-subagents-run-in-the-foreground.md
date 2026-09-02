# ADR-008: Subagents run in the foreground, and CI verifies the artifact, not the exit code

Date: 2026-09-02
Status: accepted

## Decision
Every orchestrator in the factory — the `/refresh`, `/feature` and
`/hotfix` lines, and the two workflows that run Claude headlessly —
dispatches its subagents in the **foreground** and does not end its turn
while one is still running.

CI does not treat the Claude action's exit code as evidence that a phase
ran. `refresh.yml` decides whether to retry from whether the report
exists on disk; `apply.yml` already gated its push on the verifier and
now names this failure mode when the guard fires.

## Context
Refresh rounds 9 (scheduled, 2026-09-01) and 10 (manual, 2026-09-02)
both failed at the "Publish the report" guard with `No report at
docs/refresh/2026-09-report.md`. Neither was a research failure. Round
9's result block reads:

```
"subagent_stats": {
  "spawned": 13,
  "requested": { "background": 0, "foreground": 0, "unset": 13 },
  "started_in_background": 13,
  "completed": 0, "failed": 0,
  "by_type": { "researcher": 12, "scout": 1 }
},
"is_error": false, "subtype": "success",
"stop_reason": "end_turn", "terminal_reason": "completed",
"total_cost_usd": 6.208,
"result": "Phase 1 is dispatched: 12 researchers ... plus 1 market
           scout ... I'll write docs/refresh/2026-09-report.md once
           the reports are in."
```

All thirteen subagents were requested with the background flag **unset**
and all thirteen were `started_in_background`: the Task tool's default
changed from foreground to background. The orchestrator dispatched them,
ended its turn to wait for results it expected to be woken for, and in a
headless run there is no next turn — the session closed `completed`,
`is_error: false`, with `completed: 0` subagents. Round 10 is the same
shape one researcher later: `"LangGraph is in. Waiting on the remaining
11 researchers and the scout."`

The researchers were not idle when they were discarded. Round 9's
`modelUsage` records 28 web searches and ~4.3M input tokens across the
subagent models — roughly $4.77 of the round's $6.21 was work performed,
collected by nobody, and never written down.

Two properties of the pipeline turned a harness default into a silent
round loss:

1. **The orchestrator's "wait" is not a wait.** Interactively, a
   completion notification resumes the session. Headlessly, the run *is*
   the turn. The same instruction is correct in one and fatal in the
   other, and nothing in the prompt distinguished them.
2. **The retry gated on the wrong signal.** `continue-on-error` plus
   `if: steps.research.outcome == 'failure'` was added after round 6,
   which died with `is_error: true`. This failure mode exits *green*, so
   the safety net never armed — the job ran once, produced nothing, and
   failed two steps later with no second attempt.

The report guard itself did its job: it is the reason we know the round
did not run rather than shipping a proposal built on one researcher.

## Consequences
- Both headless prompts now state that the run ends when the model stops
  and that uncollected subagents are discarded. `/refresh` and
  `/feature` carry the same rule so the interactive and CI lines cannot
  drift.
- `refresh.yml` gains a step between the two attempts that decides on the
  artifact: a green attempt that wrote no report is a failed attempt and
  the retry fires. The cost is one extra research attempt in a case that
  previously failed for free — which is the right trade when the
  alternative is a month with no refresh round.
- The two terminal guards now name `subagent_stats` in their error text,
  so the next occurrence is diagnosable from the error line rather than
  from reading the full JSON.
- Prompt wording is the primary control here, and prompt wording is not
  a guarantee. The guards are what make that acceptable: nothing reaches
  `data/tools.json` or the pages from a round that quit early, and the
  job goes red. If this recurs after the retry, the deterministic fix is
  to stop asking one session to fan out at all — invoke the action once
  per tool from a matrix job and consolidate in a separate step — at the
  cost of losing the shared triage context that makes cross-tool
  disagreements visible.
- Cost control: rounds 9 and 10 spent roughly $6 each for no artifact.
  They are CI spend and belong in `data/cost-ci-runs.json`, which is
  still empty; until it is filled, `COST_CONTROL.md` understates the
  refresh line by exactly this kind of failed round.
