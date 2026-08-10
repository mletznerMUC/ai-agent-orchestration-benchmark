# ADR-002: Sourcing is enforced on changes, not on history

Date: 2026-08-10
Status: accepted

## Decision
Existing data points carry `provenance: "legacy-unsourced"` with a null
source. `scripts/verify.mjs` reports how many remain uncited but does
not fail on them. It fails when a value *changes* without gaining a
real source URL and a checked date.

## Context
`CLAUDE.md` rule 1 requires a source next to every data point. When the
verification work began, zero of the site's 222 data points had one.
Enforcing the rule retroactively would have left two options: block all
updates until every historical number was researched, or let an agent
attach plausible-looking citations to numbers it had not verified. The
second is worse than no citation at all, because it looks like rigour.

## Consequences
The gap is visible and counted on every run instead of being papered
over. Each refresh round closes part of it naturally, since any value
that moves must be sourced to move. Numbers that never change may stay
uncited indefinitely — an accepted trade for never publishing an
invented source.
