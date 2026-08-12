---
description: Run the hotfix line — Investigate → Fix → Review → GATE. Fast, one gate, at the very end.
---

Run the hotfix pipeline for: $ARGUMENTS

Speed matters here — no plan gate, no panel. But the final rule
holds: **nothing reaches `main` without me.**

## Phase 1 — Investigate
Do this yourself, read-only. Reproduce or localize the problem:
which page, which file, which data, since which commit
(`git log`/`git blame` are your friends). Write a 5-line diagnosis:
symptom, root cause, affected files, blast radius, proposed fix in
one sentence. If you cannot find a root cause, STOP and tell me —
never fix symptoms blind.

## Phase 2 — Fix
Delegate to the `implementer` subagent on a `hotfix/<slug>` branch
with a minimal inline plan (the diagnosis + 1–3 steps). Smallest
possible change that fixes the root cause. No refactoring, no
drive-by improvements — those go through `/feature` later.

## Phase 3 — Review
Delegate to the `reviewer` subagent. Focus: does the fix match the
diagnosis, does anything else break, are the checks green.

## GATE — Merge (STOP)
Present: diagnosis, diff summary, review verdict. Offer to open the
PR. Then STOP and wait for me. After my merge: if the root cause
suggests a durable lesson, propose one line for `CLAUDE.md` or a
follow-up task for the feature line.
