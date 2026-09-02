# ADR-009: The refresh proposal branch is cut from current main, and the PAT never gets `workflow` scope

Date: 2026-09-02
Status: accepted

## Decision
`refresh.yml` cuts `refresh/<yyyy-mm>` from a freshly fetched `origin/main`
at the moment it proposes — not from the commit the job checked out when it
started — and restores only `data/tools.json` and `docs/refresh/` onto it.

`REFRESH_PAT` is **not** granted `workflow` scope.

## Context
Run 12 (2026-09-02) was the first full round after ADR-008. Its research
phase worked exactly as intended: twelve researchers and a scout dispatched
and collected in-turn, 19m35s, the report written on the first attempt with
the retry steps skipped, `DATA_CHANGED: true`, `CANDIDATES: 2`.

It then died on the last step:

```
! [remote rejected] refresh/2026-09 -> refresh/2026-09
  (refusing to allow a Personal Access Token to create or update workflow
   `.github/workflows/refresh.yml` without `workflow` scope)
```

The job checked out `main` at 10:42. A workflow edit merged to `main` at
10:47. At 11:02 the round pushed a branch cut from the 10:42 commit — so
relative to current `main` that ref carried a *different* `.github/workflows/refresh.yml`.
GitHub's push protection reads that as the token modifying a workflow file
and rejects it. A full round's findings were lost at the final step, and
the `tools.json` diff existed only on the runner.

The timing was incidental; the hazard is not. A round takes about twenty
minutes, and anything merged in that window that the runner's checkout
lacks produces the same stale-base delta. The scheduled round fires on the
1st of the month, which is exactly when workflow changes tend to land.

Granting the PAT `workflow` scope would silence the rejection. It was
rejected as the fix: it would let the refresh line rewrite its own
workflow, including the guards in ADR-008 that exist to stop a round from
proposing work it did not do. A line built on human gates should not hold
the credential that can edit its own gates. Losing a round to a failed push
is recoverable; an agent with write access to its own guardrails is a
standing risk.

There is a second, quieter reason to re-cut the branch, independent of the
push: a proposal based on a stale commit produces a PR whose diff *reverts*
whatever landed on `main` mid-round. A data PR must contain the data change
and nothing else, or the reviewer at GATE 1 is reading a diff that misstates
what merging it would do.

## Consequences
- The proposal diff is now honestly scoped by construction: two paths
  against current `main`, whatever else moved during the round.
- The push no longer depends on what else was merged while the round ran,
  so the scheduled round survives a workflow change landing beneath it.
- A new failure becomes possible and is guarded: if `main` moved
  `data/tools.json` during the round such that the round's file is
  identical to it, the round now fails loudly rather than opening an empty
  or misleading proposal. The report is archived either way, so the
  findings survive the failure — which is what made run 12 recoverable and
  is the property worth keeping.
- A round whose push fails still loses its `tools.json` diff, because that
  file is only ever committed at this final step. The archived report
  documents every change with its source, so a re-run is a re-verification
  rather than a re-discovery — but it is still a full round's cost. Making
  the proposal durable earlier (committing to the branch as soon as the
  data is written) would remove that, and is deliberately not done here:
  it would put a write to a pushed branch before the report guard has
  confirmed the round actually ran.
