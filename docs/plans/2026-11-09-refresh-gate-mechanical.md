# Plan: Make the refresh approve-before-merge gate mechanical
Branch: feature/refresh-gate-mechanical

Status: approved by the expert panel 2026-11-09 (approve with changes, all
three lenses; the changes are folded in below). Pending Markus's gate.

The gap, in one sentence: on 2026-11-09 PR #74 (`refresh:proposed`, never
`refresh:approved`) was merged by mletznerMUC with `verify` red — the exact
process error ADR-003 names and ADR-014 claims is mechanically impossible.
It was possible because **no ruleset exists on `main`**. Verified 2026-11-09:
Settings shows "You haven't created any rulesets"; the public API
`GET /repos/mletznerMUC/ai-agent-orchestration-benchmark/rules/branches/main`
returns `[]`, and `branches/main` reports `protected: false`. ADR-014 layer 1
was written as if configured, and was not. Layers 2 and 3 did not and could
not cover it: they are **agent-side** guards — a local `pre-push` hook and a
Claude Code tool-call hook — and both merges were done by Markus, a human,
outside any agent session, where neither hook runs.

**Working-tree note for the implementer:** `index.html.bak`,
the modifications to `COST_CONTROL.md`, and the untracked
`data/cost-ledger/*.json` files are Markus's own work in progress. They must
**not** be committed on this branch. Commit only the files each step names
(`git add <paths>`, never `git add -A`).

## Decisions taken while planning (the steps rely on these)

- **D1 — One job in `verify.yml`, named `refresh-gate`.** Markus chose a job
  in `verify.yml` over a separate workflow; that is the reason, and the only
  one. Job id and `name:` are both `refresh-gate`, so the check-run name is
  deterministically `refresh-gate` — that string is what Markus types into the
  ruleset. Do not vary it, and do not add a matrix (a matrix changes the
  check-run name).
- **D2 — Inline shell/expressions, not a script under `scripts/`.** The gate
  reads two booleans off the webhook payload; it has no parsing surface.
  `guard-git.mjs` is a script because it is a heuristic shell-command parser
  with real edge cases and a unit test to match; `refresh-watchdog.yml` is the
  closer precedent and keeps its logic inline. A `scripts/` module here would
  have to be fed a synthetic payload to be testable, which tests the harness,
  not the gate. Compensating check: the red path is exercised by hand on this
  PR (see Verification). Recorded as a risk below.
- **D3 — Two separate jobs, two separate required checks.** `refresh-gate`
  polices *label order*; `verify` polices *data↔page agreement*. They are
  deliberately not merged into one job: adding `refresh:approved` alone turns
  `refresh-gate` green while `verify` is still red, and that is correct —
  `verify` is the one that then blocks until `apply.yml` has written the
  pages. Both must be required checks; either alone leaves a hole.
- **D4 — `refresh-gate` never skips.** No job-level `if:`. On a push to
  `main` or a `workflow_dispatch` there is no PR payload, so the gate passes
  and says why in its log. A job skipped by `if:` produces a check run with
  conclusion `skipped`, whose treatment by required-status-check evaluation is
  not something this project should bet the gate on.
- **D5 — Only `refresh:proposed` triggers the gate.** `refresh:radar` PRs
  (refresh.yml:606) carry findings, not data, and are not in ADR-003's order.
- **D6 — No `github.event.*` interpolation inside any `run:` string.** Both
  steps of the new job use static log text; the label logic lives in `if:`
  expressions, which GitHub evaluates outside the shell. If a later change
  needs event data in a script body, it goes through `env:` first, never
  `${{ }}` inside `run:`.

## Steps

1. [x] **Add the `refresh-gate` job to `.github/workflows/verify.yml`.**
   New job alongside `verify` (no `needs:`, they run in parallel), `name:
   refresh-gate`, `runs-on: ubuntu-latest`, **no checkout** — it reads the
   event payload only. Two steps:
   - "Refuse an unapplied refresh proposal", guarded by a step-level `if:`
     combining `github.event_name == 'pull_request'`,
     `contains(github.event.pull_request.labels.*.name, 'refresh:proposed')`
     and `!contains(github.event.pull_request.labels.*.name,
     'refresh:approved')`; its `run:` emits `::error::` naming ADR-003's order
     (approve → apply → verify green → merge) and `exit 1`.
   - A reporting step with `if: always()` that prints which branch of the gate
     applied, so a green run is readable in the log rather than blank.
   Use the expression form above — no `jq`, no `toJSON` parsing, nothing to
   quote wrong — and keep both `run:` bodies free of `${{ github.event.* }}`
   (D6): the messages are static text. Add a header comment in the file's
   existing style stating what the job does, what it deliberately does *not*
   do (it does not check data↔page agreement — that is the `verify` job), and
   "see ADR-016".
   - Files: `.github/workflows/verify.yml`
   - Done when: the file parses as YAML
     (`node -e "..."` or `python3 -c "import yaml,sys;yaml.safe_load(open(sys.argv[1]))"`),
     the job id and `name:` are both exactly `refresh-gate`, there is no
     job-level `if:` and no `actions/checkout` in the new job, the reporting
     step carries `if: always()`, `grep` finds no `github.event` inside either
     `run:` block, and `node --test $(find scripts -name '*.test.mjs')` plus
     `npm run verify` still pass (local node is v20.12, so `npm test`'s `**`
     glob does not work — use the `find` form; CI is node 22).

2. [x] **Add `labeled` and `unlabeled` to `verify.yml`'s `pull_request`
   trigger types.** Currently the trigger is bare `pull_request:`, i.e. the
   default `[opened, synchronize, reopened]` — a label added after the last
   push would never re-evaluate the gate, which makes it decorative. Set
   `types: [opened, synchronize, reopened, labeled, unlabeled]`.
   **This also re-runs the `verify` job on every label change, and that is
   accepted deliberately**: `verify` has no dependencies to install, runs
   `npm test` + `npm run verify` in about a minute, and is free on a public
   repo. The obvious saving — a job-level `if:` on `verify` excluding label
   events — is *not* simple: it would publish a `verify` check run with
   conclusion `skipped` on exactly the commit whose merge the ruleset is
   gating, and this project should not depend on how that is scored. Add a
   one-line comment at the trigger saying why label events are included.
   - Files: `.github/workflows/verify.yml`
   - Done when: `on.pull_request.types` lists all five, the comment is
     present, the `verify` job body is unchanged, and the YAML still parses.

3. [x] **Write `docs/decisions/016-refresh-gate-is-a-required-check.md`**,
   following `000-template.md` (Date 2026-11-09, Status accepted, an
   "Amends ADR-014, ADR-003 and ADR-015" line in ADR-013/ADR-015 style).
   Content:
   - *Decision*: `verify.yml` gains a `refresh-gate` job that fails a PR
     carrying `refresh:proposed` without `refresh:approved`; `refresh-gate`
     and `verify` are both required checks on `main`, with no bypass.
   - *Context*: the PR #74 facts above, including the verification that no
     ruleset existed — the root cause is that ADR-014 layer 1 was recorded as
     configured and never was, so ADR-003's "enforced mechanically" and
     CLAUDE.md's "Enforced mechanically, see ADR-014" rested on nothing. The
     2026-10-02 incident (PR #65) and this one are the same incident twice.
     Both merges were human actions outside an agent session; layers 2 and 3
     are agent-side hooks and never see them.
   - *Consequences*, naming at least:
     - The split of duties (D3): label order vs. data↔page agreement.
       `refresh:approved` alone passes the gate while `verify` is still red,
       and that is intended, not a hole.
     - **Why a job in `verify.yml` and not a fifth workflow:** Markus decided
       it. The check-run name would be identical either way, so the name is
       not the reason and should not be offered as one. The accepted cost of
       the shared workflow is that `verify` re-runs on every label event
       (step 2); the benefit is one fewer workflow file to keep in step.
     - **The ruleset's existence is itself checked monthly** by
       `refresh-watchdog.yml` (step 4), because an unverified setting is how
       this ADR came to be needed.
     - Relation to ADR-003 (this is its mechanism), ADR-013 (a merge to
       `main` is also the refresh backup trigger, so making merges harder to
       do wrongly does not reduce how often a round can start), ADR-014
       (layer 1 is amended: prose claiming a ruleset is not a ruleset; the
       ADR now points here and carries a checklist) and ADR-015 (the
       watchdog gains a fourth check and keeps its fail-closed contract).
     - Fail-closed behaviour if `REFRESH_PAT` is ever removed: `apply.yml`
       would push with `GITHUB_TOKEN`, which does not re-trigger `verify` or
       `refresh-gate`, so the post-apply commit carries no check runs for the
       required names and the ruleset blocks the merge until someone re-runs
       the workflow (`workflow_dispatch` on `verify`, or an empty push). That
       is acceptable — the failure mode is "cannot merge", not "merges
       red" — and the remedy is to re-add the PAT or re-run the checks. Note
       that REFRESH_PAT is evidently present today: PR #74 was opened by
       `mletznerMUC`, not `github-actions[bot]`.
     - Adding `refresh:approved` now also starts a `verify.yml` run on the
       *pre-apply* commit, so the PR shows a red `verify` for the minutes the
       apply takes; `apply.yml`'s push then supersedes it.
     - Why the logic is inline rather than a tested script (D2).
   - A **numbered manual checklist** for Markus (the ruleset is Settings
     work, agents cannot and do not do it): 1. Settings → Rules → Rulesets →
     New branch ruleset, name it e.g. `main protection`, Enforcement:
     Active. 2. Target branches: include the default branch. 3. Bypass list:
     **empty** — no actors, including org/repo admins. 4. Enable "Require a
     pull request before merging". 5. Enable "Require status checks to
     pass" and add exactly two, by name: `verify` and `refresh-gate` (both
     appear only after this PR's workflow has run at least once; "Require
     branches to be up to date" is optional and not required by this ADR).
     6. Enable "Block force pushes" and leave branch deletion disallowed.
     7. Save. 8. Verify: `GET /repos/mletznerMUC/ai-agent-orchestration-benchmark/rules/branches/main`
     (public, no auth needed) returns a non-empty array containing
     `pull_request`, `required_status_checks` (with both check names) and
     `non_fast_forward`; and `GET .../branches/main` reports
     `"protected": true`.
   - Files: `docs/decisions/016-refresh-gate-is-a-required-check.md`
   - Done when: the file exists, follows the template's three headings plus
     the amends line, names ADR-003, ADR-013, ADR-014 and ADR-015, contains
     the numbered checklist with both exact check names, and `npm run verify`
     still passes.

4. [x] **Teach `refresh-watchdog.yml` to check the ruleset.** A manual
   setting that nothing re-reads is exactly what failed here, so the monthly
   watchdog gains a fourth check, in the file's existing style: a step
   `name: Check the main ruleset`, `id: ruleset`, `if: always()`, reading
   `gh api repos/${REPO}/rules/branches/main` with `GH_TOKEN:
   ${{ secrets.GITHUB_TOKEN }}` and `REPO: ${{ github.repository }}`, writing
   a single `problem=` line to `$GITHUB_OUTPUT` (empty = all clear) and
   `exit 0` so one check never hides another. It reports a problem when:
   - the API call fails (fails **closed**, like every other check here — the
     message quotes the error, as the existing steps do with `ERR_LOG`);
   - the array is empty (no ruleset at all — today's state);
   - no rule of `type == "pull_request"`;
   - no rule of `type == "non_fast_forward"` (GitHub's name for "block force
     pushes");
   - `required_status_checks` is absent, or its
     `parameters.required_status_checks[].context` list does not contain
     **both** `verify` and `refresh-gate` (name the missing ones).
   Use `jq` as the other steps do. Wire it into `Report` the same way as the
   rest: new env `P_RULESET` / `O_RULESET` from `steps.ruleset.outputs.problem`
   and `steps.ruleset.outcome`, and one more line
   `add_check "main ruleset" "$O_RULESET" "$P_RULESET"`. Add one remedy
   bullet to the issue body: create or repair the ruleset using the numbered
   checklist in `docs/decisions/016-refresh-gate-is-a-required-check.md`.
   **Permissions, checked against the file:** `refresh-watchdog.yml` grants
   `contents: read`, `actions: read`, `issues: write`; the rules endpoint
   needs only metadata read on a public repository, which `GITHUB_TOKEN`
   always has, so **no new `permissions:` entry is required**. If that
   assumption is wrong the call 403s, which this check reports as a problem —
   a red run, not a false all-clear.
   - Files: `.github/workflows/refresh-watchdog.yml`
   - Done when: the YAML parses, the step has `if: always()` and `exit 0` on
     every path, `Report` consumes it through `add_check "main ruleset"`
     exactly as it does the other three, the `permissions:` block is
     unchanged, the workflow still contains no dispatch/push/Anthropic key,
     and `npm run verify` passes.

5. [x] **Amend ADR-014 — do not rewrite it.** Append a dated amendment
   section in the house style used by ADR-013 (`## Amendment (2026-11-09):
   <what changed>`), stating: layer 1 described a ruleset that was never
   created; verified on 2026-11-09 by Settings ("You haven't created any
   rulesets"), `rules/branches/main` = `[]` and `branches/main`
   `protected: false`; PR #65 (2026-10-02) and PR #74 (2026-11-09) both
   merged red, and layers 2 and 3 could not have stopped either — they are
   agent-side guards (a local `pre-push` hook, a Claude Code tool-call hook
   that blocks `git push` to `main` and `gh pr merge` from an agent) and both
   merges were made by Markus himself, through the GitHub UI, outside any
   agent session. Layer 1 is the only layer that binds a human, and it was
   the missing one; it is now specified as a checklist in ADR-016 and is not
   in force until Markus has completed it, with `refresh-watchdog.yml`
   checking monthly that it still exists. Leave the original layer 1 text
   standing — including the "He added the required `verify` check on
   2026-10-02" sentence — so the record of what was believed stays visible;
   the amendment is what corrects it. Do not touch layers 2 and 3.
   - Files: `docs/decisions/014-main-is-protected-mechanically.md`
   - Done when: the original three-layer Decision text and the original
     Consequences are byte-identical to before, a new
     `## Amendment (2026-11-09): …` section exists at the end, it links
     ADR-016 and PR #74, it does not use the "layers 2 and 3 only catch
     pushes, never merges" framing, and `npm run verify` passes.

6. [x] **Correct ADR-003's last bullet.** Its "Since 2026-10-02 the order is
   enforced mechanically as well: the ruleset on `main` requires the `verify`
   check…" claim is false in the same way as ADR-014's, and a known-false
   "enforced mechanically" sentence left in a second ADR reintroduces exactly
   the failure mode ADR-016 is about. Minimal edit: re-date the claim and
   point it at ADR-016 — one or two sentences, no restructuring.
   - Files: `docs/decisions/003-refresh-approve-before-merge.md`
   - Done when: the bullet no longer asserts an existing ruleset as of
     2026-10-02, it references ADR-016, nothing else in the file changed,
     and `npm run verify` passes.

7. [x] **CLAUDE.md: exactly one line.** Two edits, both minimal, in the
   workflow-rules block:
   - Extend the existing "Nothing merges to `main` without Markus … Enforced
     mechanically, see ADR-014" to "see ADR-014 and ADR-016" — the sentence
     is the one the incident falsified, and the one-line pointer the card
     asks for belongs where a reader meets the claim.
   - Qualify it rather than delete it: append "(the ruleset itself is a
     Markus-only setting — until it exists, the gate is prose; ADR-016 has
     the checklist)". **Why qualify and not delete:** deleting it removes the
     rule and leaves CLAUDE.md silent about the mechanism; keeping it
     unqualified states something verified false on 2026-11-09. One clause is
     the smallest change that is both true today and still true the moment
     Markus finishes the checklist. The implementer must not expand this into
     a new bullet.
   - Files: `CLAUDE.md`
   - Done when: the diff is one bullet, ≤ 2 added lines, mentions ADR-016,
     and no other section of CLAUDE.md changed.

8. [x] **Repeat the ADR-016 checklist in the PR description**, quoting it and
   linking `docs/decisions/016-refresh-gate-is-a-required-check.md` as its
   source of truth, with a one-line lead ("This PR is inert until steps 1–8
   below are done in Settings — agents cannot do them"), plus the note that
   `refresh-gate` and `verify` only appear in the ruleset's check picker
   after this workflow has run once on this PR. Ordering note for Markus: the
   ruleset can be created before the merge; the two check names are already
   produced by this PR's own runs.
   - Files: none (PR body; the orchestrator opens the PR)
   - Done when: the PR body quotes the numbered checklist and the
     verification call, and links the ADR as the source of truth.

## Risks & open questions

- **The mechanism is not self-enforcing, and the watchdog's latency is up to
  a month.** Nothing in this PR can create the ruleset; until Markus
  completes the checklist, `refresh-gate` is a check that reports and does
  not block. Step 4 closes the "nobody would notice" half of ADR-014's
  failure — the ruleset's absence or weakening now produces a red run and an
  issue — but only on the 5th and the 7th. So a ruleset deleted on the 8th
  goes unreported for most of a month. That is the same detection latency
  ADR-015 already accepts for a missed refresh round, and it is accepted here
  for the same reason: the watchdog is a monthly auditor, not a tripwire.
- **Inline shell/expressions are not covered by `npm test`** (D2). A typo in
  a `contains()` expression fails open — the job goes green. Mitigation is
  the manual red-path test in Verification; it must actually be performed,
  on this PR, before the ruleset is trusted.
- **`skipped` as a required check.** The plan deliberately avoids producing
  any `skipped` check run for the two required names (D4, step 2). If Markus
  later wants to cut the extra `verify` runs on label events, the safe form
  is a tiny always-running job that reports success, not a job-level `if:`
  on `verify` — flagging this so it is not "optimised" later by accident.
- **`pull_request` vs `pull_request_target`.** The gate reads labels from
  the untrusted-fork-capable `pull_request` payload. It has no secrets and no
  checkout, so there is nothing to steal; but note that for a fork PR the
  check still reports normally, which is what we want. No change proposed.
- **The ruleset's exact JSON shape** (step 4) is asserted from the documented
  rules API: `type: "pull_request"`, `type: "non_fast_forward"`, and
  `required_status_checks` with
  `parameters.required_status_checks[].context`. The first real run against a
  configured ruleset is what confirms it; because the check fails closed, a
  wrong field name shows up as a red watchdog run naming the supposedly
  missing rule, which is noisy but not silent. Markus's step-8 API call is
  the independent cross-check.
- **Not addressed, by scope:** `docs/architecture/agentic-workflow.md` and
  `.svg` describe the refresh line but make no ruleset claim (grep found the
  claim only in ADR-003 and ADR-014), so they need no change.

## Verification

1. CI on this PR: `verify` green and `refresh-gate` green (the PR carries no
   refresh labels). Both check names appear in the PR's checks list spelled
   exactly `verify` and `refresh-gate`.
2. **Red path, by hand on this PR:** Markus (or anyone with write) adds the
   `refresh:proposed` label to this PR → a new `verify.yml` run starts within
   seconds (proves step 2) and `refresh-gate` fails with the ADR-003 error
   message (proves step 1). Then add `refresh:approved` → a new run, and
   `refresh-gate` is green while `verify` stays green (proves D3's split).
   Then remove both labels → `refresh-gate` green again. Leave the PR
   label-free before merging.
3. **Watchdog dry run:** `workflow_dispatch` of `refresh-watchdog` from this
   branch (or from `main` after the merge, before the ruleset exists) → the
   run is red and the issue/summary lists "main ruleset" among the problems,
   naming the empty ruleset list. After Markus completes the checklist, a
   second dispatch must come back with that check clear. This is the only
   end-to-end proof that step 4's `jq` matches GitHub's real payload.
4. Locally: `node --test $(find scripts -name '*.test.mjs')` and
   `npm run verify` both pass (no test or data change is expected from this
   PR; this confirms nothing was collaterally broken).
5. Docs cross-check: ADR-016 exists and the PR body quotes its checklist and
   links the ADR as the source of truth; ADR-014 has the 2026-11-09
   amendment with its original three-layer text and Consequences untouched;
   ADR-003's bullet points at ADR-016; CLAUDE.md's merge bullet points at
   ADR-016.
6. `git log --stat` on the branch shows no `index.html.bak`, no
   `COST_CONTROL.md`, and no `data/cost-ledger/*.json` — those belong to
   Markus's working tree, not this PR.
7. After the merge, Markus runs the checklist and then
   `GET /repos/mletznerMUC/ai-agent-orchestration-benchmark/rules/branches/main`
   — it must return `pull_request`, `required_status_checks` listing both
   `verify` and `refresh-gate`, and `non_fast_forward`; and
   `GET .../branches/main` must report `"protected": true`. Until that call
   returns those rules, the task is not finished, only prepared.

## PR description

<!-- Step 8 deliverable: paste this as the PR body when the orchestrator
     opens the PR. -->

### Make the refresh approve-before-merge gate mechanical

On 2026-11-09 PR #74 (`refresh:proposed`, never `refresh:approved`) was
merged with `verify` red — the process error ADR-003 names and ADR-014
claims is mechanically impossible. It was possible because **no ruleset
existed on `main`**: Settings showed "You haven't created any rulesets",
`rules/branches/main` returned `[]`, and `branches/main` reported
`"protected": false`. ADR-014's layer 1 was recorded as configured and
never was; layers 2 and 3 are agent-side hooks and never see a human
merging in the GitHub UI.

This PR adds the missing check and makes the setting auditable:

- `verify.yml` gains a `refresh-gate` job that fails a PR carrying
  `refresh:proposed` without `refresh:approved`. It polices *label
  order* only — data↔page agreement stays with `verify`, and both are
  meant to be required checks.
- `verify.yml`'s `pull_request` trigger now includes `labeled` and
  `unlabeled`, so a label change re-evaluates the gate.
- `refresh-watchdog.yml` gains a fourth monthly check that re-reads the
  ruleset on `main` and reports an empty rules list, a missing
  `pull_request` or `non_fast_forward` rule, required status checks
  that do not name both `verify` and `refresh-gate`, or a rules payload
  it cannot interpret.
- ADR-016 records the decision; ADR-014 is amended, ADR-003's
  "enforced mechanically" bullet is corrected, CLAUDE.md's merge rule
  points at ADR-016.

**This PR is inert until steps 1–8 below are done in Settings — agents
cannot do them.** `docs/decisions/016-refresh-gate-is-a-required-check.md`
is the source of truth for this checklist; the copy here is a convenience.

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

Note on ordering: `refresh-gate` and `verify` only appear in the ruleset's
check picker after this workflow has run once. This PR's own runs already
produce both names, so the ruleset can be created **before** the merge —
it does not have to wait for it.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
