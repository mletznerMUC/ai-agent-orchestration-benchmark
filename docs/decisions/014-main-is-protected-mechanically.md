# ADR-014: `main` is protected mechanically, not by prose

Date: 2026-10-02
Status: accepted

## Decision
Three layers keep agent work off `main`:

1. **A GitHub ruleset on `main`** that requires a pull request, requires
   the `verify` status check to pass before a PR can be merged, and blocks
   force pushes and branch deletion, with no bypass for anyone. Markus
   configures it in the repository settings; agents cannot and do not. He
   added the required `verify` check on 2026-10-02, after PR #65 was merged
   with `verify` red. It is compatible with ADR-003 rather than in tension
   with it: an approved proposal turns green through `apply.yml` before it
   is merged, so the check blocks exactly the case ADR-003 calls a process
   error — merging a proposal whose data has not been applied to the pages.
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
- Layer 3 parses a single shell command heuristically: it splits on the
  usual separators, drops a short list of wrappers (`env`, `command`,
  `nohup`, `time`, `stdbuf`, `setsid`, `sudo`, `timeout`, `nice`) and
  inspects what is left. Anything that keeps the real command out of that
  view is out of scope and deliberately not chased — among others, a shell
  in a string (`sh -c`, `bash -c`, `eval`), substitution (`$(…)`,
  backticks), `xargs`, wrappers beyond the ones named above, a script or
  npm target that runs git itself, and `gh api …` calls that merge. The
  list is illustrative, not exhaustive: assume there are more. Layer 1 is
  the authority; layers 2 and 3 exist to catch the mistake early and
  loudly, at the keyboard rather than in the branch history.
- The splitter also reads a heredoc body as if it were code, so a commit
  message or document that quotes a blocked command can block its own
  `git commit -F - <<'EOF'`. Workaround: write that content with the Write
  tool and pass the file path, instead of inlining a heredoc.
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

## Amendment (2026-11-09): layer 1 was never configured

Layer 1 above describes a ruleset on `main` that did not exist. Verified
on 2026-11-09: Settings → Rules showed "You haven't created any rulesets",
`GET /repos/mletznerMUC/ai-agent-orchestration-benchmark/rules/branches/main`
returned `[]`, and `GET .../branches/main` reported `"protected": false`.
The sentence "He added the required `verify` check on 2026-10-02" records
what was believed, not what was in force, and is left standing above for
that reason; this amendment is the correction.

Two pull requests were merged with `verify` red as a result: PR #65 on
2026-10-02 — the incident that prompted this ADR — and PR #74 on
2026-11-09, which carried `refresh:proposed` and never `refresh:approved`.

Layers 2 and 3 could not have stopped either. Both are **agent-side**
guards — a versioned `pre-push` hook in the clone, and a Claude Code
tool-call hook that blocks `git push` to `main` and `gh pr merge` from an
agent session — and both merges were made by Markus himself, through the
GitHub UI, outside any agent session, where neither guard is in the path.
Layer 1 is the only layer of the three that binds a human, and it was the
missing one.

Layer 1 is therefore restated as a procedure rather than a claim: the
ruleset is specified as a numbered Settings checklist in
[ADR-016](016-refresh-gate-is-a-required-check.md), it requires two checks
(`verify` and `refresh-gate`) rather than one, and **it is not in force
until Markus has completed that checklist**. `refresh-watchdog.yml` now
re-reads the ruleset monthly, so its absence or weakening produces a red
run and an issue instead of silence. Layers 2 and 3 are unchanged.
