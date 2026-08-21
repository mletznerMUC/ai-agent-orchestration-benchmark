# ADR-007: machine checks pin a published figure's spelling, not just its value

Date: 2026-08-21
Status: accepted

## Decision
Where `data/tools.json` asserts a number that appears on the pages, the
check compares the **string as written** against the one published form,
not only the parsed value. For the per-dimension rubric figures that
form is the shortest exact decimal of `weight * raw / max` rounded to two
decimals — `18.75`, `3.33`, `15` — and `scripts/verify.mjs` fails on any
other spelling of the same number.

## Context
ADR-006 introduced 142 per-dimension figures across the two pages,
checked numerically against the rubric. A review of that change wrote
`18.750` into both files: `npm run verify` and `npm test` stayed green,
because `Number('18.750') === 18.75`. The value was right and the
published figure was one the site had never published.

That gap matters more here than it would elsewhere, because
`.github/workflows/apply.yml` now instructs refresh agents to write
these figures when a rubric value changes. An agent producing
`toFixed(2)` output would emit `15.00` for `15` — numerically correct,
green on both gates, and a drift in the published form that nothing
would report. The two pages could also drift apart in spelling while
agreeing on every value.

The alternative was to keep the check numeric and treat formatting as
cosmetic. But the pages are the served artifact (ADR-001), so their bytes
*are* the product; "the number is right" is not the same claim as "this
is what we published", and only the second one is checkable by a reader
comparing the page to the rubric.

## Consequences
- `parseDimensions` returns `pointsText` alongside `points`. Anything
  parsing a published figure for verification should expose the raw text
  too, so a check can assert either.
- The spelling check runs only when the value already matches, so a wrong
  number reports as a wrong number rather than as a formatting problem.
- Rounding a figure for display is still a two-decimal half-up rounding
  (ADR-006 (d)); this decision constrains only how the result is written.
  `15.00`, `15.0`, `18.750` and `3.330` are now failures.
- This does not extend to prose. `manus-ai`'s "nicht belegt" / "not
  evidenced" is language-bound and checked structurally — no `data-raw`
  on either page — as ADR-006 specifies.
- The published `/100` totals, prices and matrix chips are not covered by
  this ADR. They are checked by the older assertions and no agent-written
  path currently reformats them; extending the same treatment to them is
  work for whoever first finds a gap there.
