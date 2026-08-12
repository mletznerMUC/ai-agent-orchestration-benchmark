# ADR-001: data/tools.json asserts, HTML serves

Date: 2026-08-10
Status: accepted

## Decision
`data/tools.json` is an assertion about what `index.html` and
`index.en.html` must contain, not a template they are generated from.
Both HTML files stay hand-edited and remain the served artifact.
`scripts/verify.mjs` proves the three agree.

## Context
The two HTML files are 88% identical and every score exists twice. The
168-cell feature matrix was positional, and matrix column order differs
from score-grid order, so a positional edit could silently corrupt the
wrong tool's row. Generating the HTML from JSON would fix the
duplication but means templatizing two working 2000-line files — a
rewrite, plus a permanent build step against the simplicity rule — for
a payoff that scales with a cadence of roughly six update rounds a year.

## Consequences
Data is still entered twice, but disagreement is now caught
mechanically rather than by reviewer attention. The verifier is
useful standalone and needs no build. If the update cadence rises
enough to justify generation, `tools.json` is already the input it
would need, so this defers that work rather than blocking it.
