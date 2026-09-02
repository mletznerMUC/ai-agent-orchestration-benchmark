# ADR-010: The apply job may commit only the served pages

Date: 2026-09-02
Status: accepted

## Decision
`apply.yml` stages `index.html` and `index.en.html` by name instead of
`git add -A`, and fails the run if the apply step modified any other
tracked file, printing the file list and the diff.

## Context
The 2026-09 round was the first time `apply.yml` actually executed. It
succeeded, `npm test && npm run verify` passed before the push, and the
proposal PR went green. It also committed two files nobody asked it to
touch:

- `scripts/lib/parse-html.test.mjs` — the price-row total, 42 → 41
- `scripts/verify.test.mjs` — the as-of stamp fixture

Both edits were correct. The first is a mechanical consequence of the
approved data removing a crewai price row; without it the suite fails on
true data. The second is better than what it replaced: the test read
`DE.replace('Stand: August 2026', …)`, a literal that would stop matching
the moment the stamp moved, leaving `broken === DE` and an assertion that
silently checks nothing. The edit derives the stamp from
`DATA.meta.asOf.de` and asserts the fixture matched.

So this is not a story about a model damaging tests. It is a story about
that being indistinguishable, from inside the pipeline, from one that did.

Nothing in the job established either edit was sound. The pre-push gate
runs `npm test` — so by the time it goes green it is running the *edited*
tests. A gate that executes the change it is meant to police cannot police
it. `git add -A` then committed the result. The edits reached a human only
because someone read the PR's file list and asked why it had six entries
instead of four.

The failure mode this guards against is narrow and serious: an apply run
that cannot satisfy the verifier could, in principle, edit the verifier's
own tests until it can, and every signal this workflow produces would still
be green. On a benchmark whose product is that its numbers can be trusted,
that is the one thing the automation must not be able to do quietly.

Refusing is better than allowlisting. A test that needs to change because
approved data moved a value is a real event — it happened this round and
will happen again — but it is a change to how the benchmark is checked,
not to what it claims, and those are different reviews. Folding it into a
data proposal hides it inside a diff a reviewer is reading for data.

## Consequences
- An apply run that needs a test change now fails instead of pushing. The
  round stalls until a human lands that change against `main` and the
  label is re-applied. That is the intended cost: it converts a silent
  commit into a deliberate decision.
- Untracked files are unaffected — they were never committed under
  explicit paths, so a scratch file cannot block a round.
- **Known follow-up.** `parse-html.test.mjs` asserts a hardcoded price-row
  total, so any approved change to a price card trips this guard. That
  literal is the same fragility `verify.test.mjs` just had, and it should
  be derived from `data/tools.json` the same way. It is deliberately not
  fixed here: PR #51 is open and edits that exact line, so changing it now
  would conflict with a proposal awaiting merge. It must land after #51
  and before the October round, or the first thing this ADR does is block
  a legitimate refresh.
- This is the third guard in the refresh line that exists because a step
  reported success while doing nothing useful, or something unasked
  (ADR-008, ADR-009). The pattern worth naming: in this pipeline, a green
  exit code is evidence that a program ran, never that the work was done
  or that only the intended work was done. Guards assert on artifacts.
