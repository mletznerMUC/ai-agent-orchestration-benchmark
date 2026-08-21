# CLAUDE.md — AI Agent Orchestration Benchmark

## What this project is
A public benchmark site (GitHub Pages) comparing AI agent orchestration
tools. Credibility is the product: every score, claim, and comparison
must be sourced and reproducible. When in doubt, understate.

## Non-negotiable standards
1. **Data integrity.** Never change a score, ranking, or tool claim
   without a verifiable source (docs, changelog, release notes). Cite
   the source next to the data point. No source → no change.
   Enforced by `npm run verify` against `data/tools.json`; see
   ADR-001 and ADR-002 for what is and is not checked.
2. **Methodology consistency.** All tools are scored against the same
   published criteria. Adding a criterion means re-evaluating every
   tool against it, not just the new one.
3. **Neutrality.** No promotional language for or against any vendor.
   Descriptive, verifiable statements only.
4. **Simplicity.** Static site, no build-step creep. Prefer plain
   HTML/CSS/JS over frameworks. Every dependency needs a reason.

## Workflow rules (the factory)
- Work runs through pipelines, started via `/feature`, `/hotfix`, or
  `/refresh`.
- Two human gates in the feature line: plan approval and PR merge.
  One gate in the hotfix line: PR merge.
- Two gates in the refresh line, **in order**: change approval (the
  `refresh:approved` label on the proposal PR, which triggers `apply.yml`
  to write the pages and turn `verify` green) and *then* PR merge. Never
  merge a `refresh:proposed` PR while `verify` is red — that red is the
  gate detecting data that has not been applied to the pages yet, not
  noise to merge past (see ADR-003). The scheduled research runs
  monthly and is read-only — it proposes, it never applies. Each round
  researches **every** tool and also scouts the market for tools not yet
  in the benchmark. Scouted tools become radar candidates only: adding
  one to the benchmark means scoring it against every published
  criterion, which is `/feature` work, not a data refresh.
- **Nothing merges to `main` without Markus.** Agents never merge,
  never push to `main`, never tag releases.
- Each phase = one subagent with a clean context. The plan file
  (`PLAN.md`) is the only shared state between phases.
- Implementer marks each plan step as done **immediately** after
  completing it, before starting the next. If a step is already
  implemented in the codebase, mark it done and move on — never
  re-implement existing work.

## Conventions
- Branches: `feature/<slug>`, `hotfix/<slug>`, `chore/<slug>`
- Commits: conventional commits (`feat:`, `fix:`, `data:`, `docs:`)
- `data:` commits touch scoring/benchmark data and must reference a
  source in the commit body.
- Generated ledgers (`COST_CONTROL.md`) are refreshed on their own
  `chore/` branch, never inside a feature branch. A feature PR's diff
  should contain only that feature — a reviewer reading it should not
  have to decide which files are the change and which are along for the
  ride.
- Decisions that outlive a PR go to `docs/decisions/` as a short ADR
  (one file per decision, `NNN-title.md`).

## Memory
Before planning or implementing anything, read `docs/decisions/`.
After every merged PR, the reviewer proposes (never writes silently)
an update to this file or a new ADR if a durable decision was made.
