# PLAN — hotfix: refresh watchdog

Branch: `hotfix/refresh-watchdog`
Status: approved (hotfix line — no plan gate; Markus asked for this hotfix directly)
Do NOT commit this PLAN.md file.

## Diagnosis
- Symptom: a month whose refresh round never runs (all three cron slots of
  ADR-011 dropped, and no push to `main` per ADR-013 amendment) produces no
  signal at all. Likewise GitHub silently disables `schedule` triggers in a
  public repo after 60 days without repository activity.
- Root cause: every safeguard lives inside `refresh.yml` and only runs when
  a trigger fires; nothing checks *after the fact* that the month's round
  happened.
- Affected files: new `.github/workflows/refresh-watchdog.yml`, new
  `docs/decisions/015-refresh-watchdog.md`. `refresh.yml` is NOT touched.
- Blast radius: read-only API calls plus opening one issue. The watchdog
  must never dispatch `refresh.yml`, never call Anthropic, never push.
- Fix: a separate scheduled workflow later in the month that applies the
  guard's own "round done" tests and checks `refresh.yml`'s state, failing
  red and opening one deduplicated issue when something is wrong.

## Steps

- [x] **1. Add `.github/workflows/refresh-watchdog.yml`.**
  Match the comment style and density of `refresh.yml` (header comment
  explaining purpose, what it never does, ADR reference).
  - Triggers: `schedule` with two off-peak slots, `'37 9 5 * *'` and
    `'13 10 7 * *'` (second is the watchdog's own fallback — same
    best-effort scheduler); plus `workflow_dispatch` (no inputs).
  - `permissions:` exactly `contents: read`, `actions: read`,
    `issues: write`. Uses only `secrets.GITHUB_TOKEN` (`GH_TOKEN` env for
    `gh`). No other secrets.
  - `concurrency: { group: refresh-watchdog, cancel-in-progress: false }`.
  - One job, `ubuntu-latest`. No checkout needed except where noted; use
    `gh api` and `git ls-remote https://github.com/${REPO}` (public repo)
    or `gh api repos/${REPO}/branches/refresh%2F${MONTH}` — implementer's
    choice, but no checkout of code is required.
  - Step "Check this month's round" — MONTH=`date -u +%Y-%m`. The round is
    done when EITHER (same two tests as the `refresh.yml` guard, ADR-011):
    1. branch `refresh/${MONTH}` exists on the remote, OR
    2. a `refresh.yml` run created this month with `status=success` has a
       `display_title` starting with `refresh full` **and** is not a pure
       guard skip. Note: a guard-skipped run is also green and titled
       `refresh full`, but per ADR-011 that only happens downstream of a
       real round or a real branch, so counting any such run is
       acceptable — do the same as the guard (`--paginate`, `jq -s`).
    Unlike the guard, the watchdog fails **closed**: if the API call
    errors, report it as a problem (cannot confirm the round), because the
    watchdog's whole job is to surface uncertainty.
  - Step "Check the refresh schedule is enabled" —
    `gh api repos/${REPO}/actions/workflows/refresh.yml --jq .state`.
    Anything other than `active` is a problem; name the state
    (`disabled_inactivity` = GitHub's 60-day rule, `disabled_manually`).
  - Step "Check inactivity" — date of the latest commit on the default
    branch (`gh api repos/${REPO}/commits?per_page=1`). If it is ≥ 28 days
    old, that is a problem: the watchdog runs monthly, so by its next run
    the repo would cross GitHub's 60-day line and both this watchdog and
    the refresh cron would stop. Message says how many days remain and
    that any commit to `main` resets it.
  - Step "Report" (runs `if: always()` after the checks, collecting their
    outputs): if no problems → `::notice::` + one line to
    `$GITHUB_STEP_SUMMARY`, exit 0. If problems → write them to the run
    summary, then open an issue titled exactly
    `Refresh watchdog: ${MONTH} needs attention` unless an OPEN issue with
    that exact title already exists (then add a comment instead), then
    `exit 1` so the run is red. Issue body: the list of problems, the run
    URL, and the remedy ("run `refresh-research` via workflow_dispatch" /
    "re-enable the workflow under Actions" / "any merge to main resets the
    60-day clock"). No labels required (do not create labels).
  - Done when: YAML parses (`python3 -c "import yaml,sys;yaml.safe_load(open(sys.argv[1]))" <file>`
    or `node`-based equivalent), `actionlint` passes if available
    (skip if not installed — say so), every shell block uses
    `set -euo pipefail` or `set -uo pipefail` as appropriate, and
    grep confirms the file contains no `workflow_dispatch` call /
    `gh workflow run` / `actions/workflows/.../dispatches` / Anthropic key.

- [x] **2. Add `docs/decisions/015-refresh-watchdog.md`** following
  `000-template.md` (Date 2026-10-06, Status accepted, "Amends ADR-011 and
  ADR-013" line like ADR-013 does). Decision: separate watchdog workflow,
  5th and 7th, reports only, never starts a round. Context: Oct 2026
  record (1st slot dropped, 2nd/3rd 5–6 h late, round came from a manual
  dispatch), the ADR-013 amendment's stated gap (quiet month = no retry,
  no signal), and GitHub's 60-day schedule auto-disable. Consequences:
  fails closed (unlike the guard, and why); a dropped watchdog slot is
  covered by its second slot but the watchdog shares the scheduler's
  failure mode, so it reduces, not eliminates, silent misses; the
  inactivity warning at 28 days exists because a disabled watchdog cannot
  report its own disabling; the remedy is always human (manual dispatch),
  consistent with "the scheduled research proposes, never applies" and
  with ADR-013 amendment (no token for unattended dispatch). Keep it as
  short as ADR-011.
  - Done when: file exists, references ADR-011/ADR-013, `npm test` and
    `npm run verify` still pass.

## Risks & open questions
- The watchdog runs on GitHub's own best-effort scheduler, so it can be
  dropped too; two slots mitigate, do not eliminate.
- Whether opening an issue counts as "repository activity" for the 60-day
  rule is not documented clearly; the plan does not rely on it.
