# ADR-011: The scheduled refresh has fallback slots and an idempotency guard

Date: 2026-10-01
Status: accepted

## Decision
`refresh.yml` is scheduled three times a month — `17 6 1 * *`, `41 7 2 * *`
and `23 8 3 * *` — instead of once. A guard step immediately after checkout
makes a *scheduled* run exit before any paid step when `refresh/<yyyy-mm>`
already exists on the remote, or when a run titled `refresh full` has
already succeeded this month. The branch check runs first: it is free and
needs no API. Manual dispatch is never blocked.

## Context
The single trigger was `0 6 1 * *`. In its lifetime it fired from the
schedule exactly once: on 2026-09-01, starting at 11:29 UTC — five and a
half hours after the nominal time. On 2026-10-01 it had not fired at all by
12:02 UTC, with the workflow in state `active`.

That is not a misconfiguration. GitHub documents scheduled triggers as
best-effort: they may be delayed during periods of high load, and runs may
be dropped entirely. Load peaks at the start of every hour, and minute 0 of
06:00 on the 1st of the month is about the most contended slot available.
A monthly cadence with a single attempt means one dropped delivery costs
the whole month's evidence — and the refresh line's whole point is that a
round leaves a record even when nothing changed.

Redundant slots alone would reintroduce a different problem: three paid
rounds a month, three branches contending for `refresh/<yyyy-mm>`. Hence
the guard. Its second check uses the runs API, which exposes a run's
`display_title` but not its inputs, so the workflow now sets `run-name` to
classify itself (`refresh full …` / `refresh debug …`) using the same test
the "Compute round id" step uses. That check fails *open*: if the API call
errors the round runs, because a missed month is worse than a duplicate
attempt — and by then the free branch check has already run, with the
`refresh-research` concurrency group still standing between a duplicate
and a duplicate PR.

## Consequences
- Up to three scheduled attempts per month, but at most one paid round:
  the 2nd and 3rd cost a checkout and one API call when the 1st worked.
- A round that *failed* — a dropped trigger, a dead API, the push rejection
  of ADR-009 — is retried automatically the next day instead of waiting for
  a human to notice. The month is the round id, so the retry is the same
  round, filing the same `docs/refresh/<yyyy-mm>-report.md`.
- Manual `workflow_dispatch` is unaffected, including a deliberate re-run
  after a successful round. The gate is for unattended schedules only.
- A skipped fallback finishes green and carries a `refresh full` title, so
  it counts as a prior full round for the next slot. That only ever happens
  downstream of a real round or a real proposal branch, so the chain cannot
  start from nothing.
- The branch check is deliberately coarser than "a proposal exists". A round
  that pushed `refresh/<yyyy-mm>` and then failed before `gh pr create` —
  or whose PR was opened and later deleted — leaves the branch behind, and
  every later slot skips on it. The month then has a branch and no
  proposal. That is the intended trade: the failed run is red and is the
  signal, and re-running is one `workflow_dispatch` away (manual dispatch
  bypasses the guard entirely). An automatic retry would instead collide
  with the existing branch at `git checkout -B`.
- Successful runs created before this change carry no `run-name`, so they
  are not counted. They all predate the current month, which is the only
  window the guard looks at.
