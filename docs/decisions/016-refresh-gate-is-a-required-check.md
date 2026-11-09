# ADR-016: The refresh approve-before-merge gate is a required check

Date: 2026-11-09
Status: accepted

Amends ADR-014, ADR-003 and ADR-015.

## Decision
`verify.yml` gains a second job, `refresh-gate`, which fails any pull
request carrying the `refresh:proposed` label without `refresh:approved`.
`refresh-gate` and `verify` are both required status checks on `main`,
configured in a branch ruleset with an empty bypass list, so neither can
be merged past — by an agent or by a human.

## Context
On 2026-11-09, PR #74 — labelled `refresh:proposed`, never
`refresh:approved` — was merged by mletznerMUC with `verify` red. That is
exactly the process error ADR-003 names, and exactly what ADR-014 claims is
mechanically impossible.

It was possible because **no ruleset existed on `main`**. Verified the same
day: the repository's Settings page showed "You haven't created any
rulesets"; the public API
`GET /repos/mletznerMUC/ai-agent-orchestration-benchmark/rules/branches/main`
returned `[]`; and `GET .../branches/main` reported `"protected": false`.
ADR-014's layer 1 was written as if the ruleset were configured — including
"He added the required `verify` check on 2026-10-02" — and it was not. So
ADR-003's "the order is enforced mechanically as well" and CLAUDE.md's
"Enforced mechanically, see ADR-014" both rested on nothing.

The 2026-10-02 incident (PR #65, merged red) and this one are the same
incident twice. ADR-014's layers 2 and 3 did not and could not cover
either: they are **agent-side** guards — a versioned `pre-push` hook and a
Claude Code tool-call hook — and both merges were made by Markus himself,
outside any agent session, where neither hook runs.
Layer 1 is the only layer that binds a human, and it was the missing one.

## Consequences
- **Two checks, two duties.** `refresh-gate` polices *label order*;
  `verify` polices *data↔page agreement*. They are deliberately not one
  job. Adding `refresh:approved` alone turns `refresh-gate` green while
  `verify` is still red, and that is intended, not a hole: `verify` is then
  the check that blocks until `apply.yml` has written the pages. Both must
  be required; either alone leaves a gap.
- **Why a job in `verify.yml` and not a fifth workflow.** Markus decided
  it. The check-run name would be identical either way, so the name is not
  the reason and should not be offered as one. The accepted cost of
  sharing the workflow is that `verify` re-runs on every label event (the
  trigger now lists `labeled`/`unlabeled`); the benefit is one fewer
  workflow file to keep in step.
- **The ruleset's existence is itself checked monthly** by
  `refresh-watchdog.yml`, which gains a fourth check reading
  `rules/branches/main` and reporting an empty list, a missing
  `pull_request` or `non_fast_forward` rule, or a
  `required_status_checks` rule that does not name both `verify` and
  `refresh-gate` — or a rules payload it cannot interpret. An unverified
  setting is how this ADR came to be needed,
  so the setting is now re-read rather than remembered. The watchdog keeps
  its ADR-015 fail-closed contract: an API error is reported as a problem,
  never as an all-clear. Its latency is up to a month — it is a monthly
  auditor, not a tripwire.
- **Relation to the other ADRs.** This is the mechanism ADR-003 describes
  in prose; ADR-003's last bullet is corrected to point here instead of
  asserting a 2026-10-02 ruleset. ADR-013 is unaffected in substance: a
  merge to `main` is also the refresh backup trigger, and making merges
  harder to do *wrongly* does not reduce how often a round can start.
  ADR-014's layer 1 is amended — prose claiming a ruleset is not a
  ruleset; it now points here and carries the checklist below. ADR-015
  gains the fourth check described above.
- **Fail-closed if `REFRESH_PAT` is ever removed.** `apply.yml` would then
  push with `GITHUB_TOKEN`, whose pushes do not re-trigger workflows, so
  the post-apply commit would carry no check runs for the two required
  names and the ruleset would block the merge until someone re-runs them
  (`workflow_dispatch` on `verify`, or an empty push). That is acceptable:
  the failure mode is "cannot merge", not "merges red". The PAT is
  evidently present today — PR #74 was opened by `mletznerMUC`, not
  `github-actions[bot]`.
- **A short red window on approval.** Adding `refresh:approved` now also
  starts a `verify.yml` run on the *pre-apply* commit, so the PR shows a
  red `verify` for the minutes the apply takes; `apply.yml`'s push then
  supersedes it with a run on the applied commit.
- **The gate's logic is inline, not a tested script.** It reads two
  booleans off the webhook payload through `contains()` expressions; there
  is no parsing surface to unit-test. `guard-git.mjs` is a script because
  it is a heuristic shell-command parser with real edge cases;
  `refresh-watchdog.yml` is the closer precedent and keeps its logic
  inline. The cost is that a typo in a `contains()` expression fails open,
  so the red path is exercised by hand on the PR that introduces it.

## The ruleset is a manual setting — checklist for Markus
Agents cannot create rulesets, and this PR is inert until these steps are
done in Settings. This ADR is the source of truth for the list.

1. Settings → Rules → Rulesets → **New branch ruleset**. Name it e.g.
   `main protection`; Enforcement: **Active**.
2. Target branches: include the **default branch**.
3. Bypass list: **empty** — no actors, including organisation and
   repository admins.
4. Enable **Require a pull request before merging**.
5. Enable **Require status checks to pass** and add exactly two, by name:
   `verify` and `refresh-gate`. (Both appear in the picker only after this
   PR's workflow has run at least once. "Require branches to be up to
   date" is optional and not required by this ADR.)
6. Enable **Block force pushes**, and leave branch deletion disallowed.
7. Save.
8. Verify:
   `GET /repos/mletznerMUC/ai-agent-orchestration-benchmark/rules/branches/main`
   (public, no auth needed) returns a non-empty array containing
   `pull_request`, `required_status_checks` (whose contexts list both
   `verify` and `refresh-gate`) and `non_fast_forward`; and
   `GET /repos/mletznerMUC/ai-agent-orchestration-benchmark/branches/main`
   reports `"protected": true`.

Until that call returns those rules, the gate is prose.
