# CLAUDE.md — AI Agent Orchestration Benchmark

## What this project is
A public benchmark site (GitHub Pages) comparing AI agent orchestration
tools. Credibility is the product: every score, claim, and comparison
must be sourced and reproducible. When in doubt, understate.

## Non-negotiable standards
1. **Data integrity.** Never change a score, ranking, or tool claim
   without a verifiable source (docs, changelog, release notes). Cite
   the source next to the data point. No source → no change.
2. **Methodology consistency.** All tools are scored against the same
   published criteria. Adding a criterion means re-evaluating every
   tool against it, not just the new one.
3. **Neutrality.** No promotional language for or against any vendor.
   Descriptive, verifiable statements only.
4. **Simplicity.** Static site, no build-step creep. Prefer plain
   HTML/CSS/JS over frameworks. Every dependency needs a reason.

## Workflow rules (the factory)
- Work runs through pipelines, started via `/feature` or `/hotfix`.
- Two human gates in the feature line: plan approval and PR merge.
  One gate in the hotfix line: PR merge.
- **Nothing merges to `main` without Markus.** Agents never merge,
  never push to `main`, never tag releases.
- Each phase = one subagent with a clean context. The plan file
  (`PLAN.md`) is the only shared state between phases.
- Implementer marks each plan step as done **immediately** after
  completing it, before starting the next. If a step is already
  implemented in the codebase, mark it done and move on — never
  re-implement existing work.

## Conventions
- Branches: `feature/<slug>`, `hotfix/<slug>`
- Commits: conventional commits (`feat:`, `fix:`, `data:`, `docs:`)
- `data:` commits touch scoring/benchmark data and must reference a
  source in the commit body.
- Decisions that outlive a PR go to `docs/decisions/` as a short ADR
  (one file per decision, `NNN-title.md`).

## Memory
Before planning or implementing anything, read `docs/decisions/`.
After every merged PR, the reviewer proposes (never writes silently)
an update to this file or a new ADR if a durable decision was made.
