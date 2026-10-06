# ADR-015: A watchdog checks that the month's refresh round happened

Date: 2026-10-06
Status: accepted

Amends ADR-011 and ADR-013.

## Decision
A separate workflow, `refresh-watchdog.yml`, runs on the 5th and the 7th of
each month and asks whether the month's round exists. It applies the
`refresh.yml` guard's own two tests from the outside — the proposal branch
`refresh/<yyyy-mm>` on the remote, a successful `refresh full` run this
month — and adds two the guard cannot make about itself: that `refresh.yml`
is still in state `active`, and that the default branch has had a commit in
the last 28 days. When anything is wrong the run goes red and files one
deduplicated issue per month. It never starts a round: no dispatch, no
Anthropic call, no push.

## Context
Every safeguard so far lives inside `refresh.yml` and only runs when a
trigger fires. October 2026 is the record: the 1st slot was dropped, the
2nd and 3rd arrived five to six hours late, and the round that actually
delivered came from a manual dispatch. ADR-013's amendment named the
remaining gap itself — a month whose round failed or was never delivered,
and in which nothing is merged afterwards, gets no automatic retry. It also
gets no signal: a silent month and a month that found nothing look the
same from the outside.

Underneath that sits a slower failure. GitHub disables `schedule` triggers
in a public repository after 60 days without repository activity, and says
nothing when it does. Both failures are invisible by construction, so the
check has to come from somewhere other than the thing being checked.

## Consequences
- The watchdog fails **closed**, the opposite of the guard. The guard runs
  a round when the API will not answer, because a duplicate attempt is
  cheaper than a missed month; the watchdog's only product is certainty,
  so "cannot confirm" is a problem it reports.
- It runs on the same best-effort scheduler it is watching. Two slots cover
  one dropped delivery, but they share the failure mode — this reduces
  silent misses, it does not eliminate them.
- The inactivity check at 28 days exists because a disabled watchdog cannot
  report its own disabling. It warns while there is still a month of margin
  before GitHub's 60-day line, and any commit to `main` resets the clock.
- The remedy is always human: a `workflow_dispatch` of `refresh-research`,
  which ADR-011 leaves deliberately unguarded. The watchdog proposes and
  never applies, like the research round itself, and for the same practical
  reason as ADR-013's amendment — nothing here holds a token that could
  dispatch unattended.
- It is read-only plus one issue: `contents: read`, `actions: read`,
  `issues: write`, and no secret but the automatic `GITHUB_TOKEN`.
  `refresh.yml` is unchanged.
