# ADR-013: The refresh backup is dispatched externally, and opts into the guard

Date: 2026-10-02
Status: accepted

Amends ADR-011.

## Decision
`refresh.yml` gains a `backup` workflow_dispatch input (`false` / `true`,
default `false`). A dispatch with `backup: true` is subject to the same
"has this month's round already run?" guard as a scheduled run; a dispatch
without it is not. The backup dispatches themselves come from an external
Claude cloud routine that runs on the 2nd and the 3rd of each month and
calls `workflow_dispatch` with `tools` empty, `scout` true and
`backup` true — i.e. a full round, guarded. The three cron slots of
ADR-011 stay exactly as they are: they are a free first line, and when one
of them does deliver, the routine's dispatch the next day costs a checkout
and one API call.

## Context
ADR-011 added fallback slots because GitHub's scheduled triggers are
best-effort. The record since shows the fallbacks do not fix that, because
they lean on the same mechanism: 2026-09-01 fired five and a half hours
late; 2026-10-01 never fired at all; the 2026-10-02 07:41 UTC fallback slot
had not fired four hours after its nominal time. The workflow is `active`,
the cron expressions are valid, and the minutes are already off-peak. Adding
a fourth or fifth slot buys nothing — they share the failure mode.

A trigger that does not depend on GitHub's scheduler does not share it, so
Markus moved the backup out of the repository and into a Claude cloud
routine. That leaves one repo-side gap: the guard step was conditioned on
`github.event_name == 'schedule'` (refresh.yml, commit 1471fc4), so a
routine-dispatched backup would have run unguarded and paid for a second
full round in a month that already had one. The input closes exactly that
gap and nothing else.

## Consequences
- A human `workflow_dispatch` is still unguarded, which is what ADR-011
  requires: a deliberate re-run after a successful round must not be
  blocked. Opting in is a choice the caller makes, and only the routine
  makes it.
- The routine needs a GitHub token with Actions: write on this repository.
  Markus provisions it in the routine's own configuration. Agents never
  handle, see, or commit that token, and it is not a repository secret.
- The routine is configured outside this repository, so its definition
  lives nowhere in git. This ADR is the record of what it does: 2nd and
  3rd of the month, `tools` empty, `scout` true, `backup` true.
- The guard is unchanged in substance. Check 1 (the month's proposal branch
  exists) is still free; check 2 (a `refresh full` run already succeeded
  this month) still fails **open**, so a dead runs API costs a duplicate
  attempt rather than a missed month. The `refresh-research` concurrency
  group still serialises a schedule slot and a routine dispatch that
  overlap.
- A backup dispatch classifies identically to a scheduled run: empty
  `tools` and `scout: true` make it `refresh full workflow_dispatch` in the
  run name and non-debug in "Compute round id", so it can both discharge
  the month's round and be counted as one by a later slot.
