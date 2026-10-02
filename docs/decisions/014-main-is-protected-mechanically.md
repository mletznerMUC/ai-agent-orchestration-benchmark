# ADR-014: `main` is protected mechanically, not by prose

Date: 2026-10-02
Status: accepted

## Decision
Three layers keep agent work off `main`:

1. **A GitHub ruleset on `main`** that requires a pull request and blocks
   force pushes and branch deletion, with no bypass for anyone. Markus
   configures it in the repository settings; agents cannot and do not.
2. **A versioned `.githooks/pre-push`** that refuses `refs/heads/main`,
   `refs/heads/master` and `refs/tags/*`. Enabled per clone with
   `git config core.hooksPath .githooks`.
3. **A Claude Code `PreToolUse` guard** (`.claude/hooks/guard-git.mjs`)
   that inspects every `Bash` command and allows only
   `git push [--dry-run] [-u] origin <feature|hotfix|refresh|docs>/<name>`.
   It also blocks `gh pr merge`, `gh release create`, tag creation,
   `--no-verify`, and any change to `core.hooksPath` or the hook files.

## Context
On 2026-10-02 at 13:58:43 local time, commits 37cbffe and 1e649bc, made on
`hotfix/refresh-backup-dispatch-guard`, were pushed from a local clone
straight to `origin/main` during the subagent phase of a hotfix, without
Markus merging. The branch had been created from `origin/main` with git's
default tracking, so its upstream was `origin/main` and a bare `git push`
went there. CLAUDE.md's "agents never push to `main`" was prose only;
nothing enforced it. Markus kept the commits.

## Consequences
- Regex guards can be evaded, by an agent or by a shell construct the
  splitter does not model. Layer 1 is the authority; layers 2 and 3 exist
  to catch the mistake early and loudly, at the keyboard rather than in the
  branch history. Known and accepted limits of layer 3, deliberately not
  chased: `sh -c "…"` and `bash -c "…"`, `eval`, command substitution
  `$(…)`, `xargs`, and `gh api …` calls that merge. Each hides the real
  command inside a string the splitter does not open.
- The guard fails open, visibly, on input it cannot parse — layers 1 and 2
  are what make the rule hold.
- No workflow pushes to `main`. `apply.yml` checks out the proposal PR's
  head ref and pushes back to that branch; `refresh.yml` pushes
  `refresh/<month>` with `-u`. Both open or comment on PRs and neither
  merges, so the ruleset breaks no CI.
- The orchestrator's own push happens after the review phase, when it
  offers to open the PR, and is limited to the
  allow-listed form, `git push -u origin <branch>`. Implementer and
  reviewer do not push at all; branches are created with
  `git switch --no-track -c <branch> origin/main`, so they have no
  upstream to push to by accident.
- The versioned hook only runs where `core.hooksPath` points at
  `.githooks`. That is a one-line setup per clone, and it is deliberately
  not something an agent sets, since a command that can set it can unset
  it.
