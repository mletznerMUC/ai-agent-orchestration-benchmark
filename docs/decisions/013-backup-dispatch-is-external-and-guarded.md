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

## Amendment (2026-10-02): the backup is a push to `main`, not an external routine

The external Claude cloud routine above was never set up, and will not be:
it needs a GitHub token with Actions: write, and Markus cannot provision
one for it. The decision stands on the part it got right — the backup must
not depend on GitHub's scheduler — and changes the trigger to one the
repository already produces several times a week.

**Every push to `main` — in practice every pull request merge — now
triggers `refresh.yml`**, behind the same "has this month's round already
run?" guard as a scheduled run. `on.push.branches` is `[main]`; the guard's
condition gains `github.event_name == 'push'`. A push carries no inputs, so
such a run classifies exactly as a scheduled one does: `refresh full push`
in the run name, non-debug in "Compute round id". The three cron slots of
ADR-011 stay as they are, as the free first line.

The `backup` dispatch input stays, unused. It costs nothing, and a future
dispatcher — a routine with a token, a second repository, anything
unattended — opts into the guard with it rather than re-deriving the
condition.

## Consequences of the amendment
- A month whose round failed or was never delivered, and in which nothing
  is merged afterwards, gets no automatic retry. The backup is only as
  frequent as the repository's merges; a quiet month falls back to a manual
  `workflow_dispatch`. This is the trade for a trigger that needs no token
  and no external service.
- Each merge costs a checkout and at most one API call once the month's
  round is done: check 1 (the proposal branch exists) is free, and check 2
  is a single runs-API query. Nothing paid runs after a skip.
- A round that keeps failing is retried once per merge, not once per month.
  The guard skips on a *successful* full round or an existing proposal
  branch, so a persistently red round will be attempted again at the next
  merge — more attempts than ADR-011's three, and each one costs a real
  round. A repeatedly failing round should be disabled or fixed, not left
  to retry.
- A merged refresh proposal PR is itself a push to `main`, and it skips —
  on check 2, the successful `refresh full` run the round left behind.
  Check 1 does not carry it: head branches such as `refresh/2026-10` are
  auto-deleted on merge, so the proposal branch is gone by the time the
  push event fires. The same holds for the merge of the applied pages.
- A month's round can now start with the first merge after 00:00 UTC on
  the 1st, which may land before the 06:17 cron slot. The cron then finds
  the guard satisfied and skips. The slots are still the free first line
  of ADR-011; they are simply no longer guaranteed to be first.
- The workflow cannot trigger itself. It pushes `refresh/<month>` and opens
  a pull request; it never pushes `main`, and nothing in the refresh or
  apply line merges (ADR-014).
- The `refresh-research` concurrency group, `cancel-in-progress: false`,
  still serialises a merge-triggered run against a cron slot or a dispatch,
  so two triggers landing together cannot produce two proposals.
- Human `workflow_dispatch` is still unguarded, unchanged from ADR-011.
