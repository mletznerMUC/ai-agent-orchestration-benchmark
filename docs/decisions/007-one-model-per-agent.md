# ADR-007: Every agent pins its own model, and the panel is three agents

Date: 2026-08-25
Status: accepted

## Decision
Each subagent in `.claude/agents/` declares a `model:` in its
frontmatter, pinned to a full model ID rather than an alias or
`inherit`. The expert panel, previously one subagent running three
lenses in one context, is split into three subagents —
`panel-architecture`, `panel-security`, `panel-compliance` — so each
lens can carry its own model. `/feature` Phase 3 runs them in
parallel and merges the verdicts.

| Agent | Model | Why this tier |
| --- | --- | --- |
| `planner` | `claude-opus-5` | `PLAN.md` is the only shared state between phases. A step that is subtly ungrounded in the code reads fine at the gate and costs a full implement-and-review round. |
| `implementer` | `claude-opus-5` | The only agent with write access, and the highest-volume one. It edits two 2 000-line HTML files where the matrix is positional (ADR-001) — the failure mode is a silent edit to the wrong tool's row. |
| `reviewer` | `claude-opus-5` | Last check before the merge gate, and the only step that verifies a cited source actually supports the value. "Verify, don't trust" is not a cheap instruction to follow. |
| `panel-architecture` | `claude-opus-5` | Counterfactual judgment — will a future change here be easier or harder — against the whole repo and every accepted ADR. The hardest of the three lenses. |
| `panel-security` | `claude-sonnet-5` | A small, well-bounded surface: a static site with no backend, no auth, no database. The check is whether the plan adds an external origin, a script, a URL parameter, or a secret. |
| `panel-compliance` | `claude-sonnet-5` | Applying written standards — CLAUDE.md rules 2 and 3, ADR-005 — to a plan, rather than forming new judgment. |
| `researcher` | `claude-sonnet-5` | Structured extraction from fetched pages into a fixed template under a hard no-source-no-finding rule. Also the largest fan-out — roughly twelve in parallel per refresh round — so the tier difference compounds here more than anywhere else. |
| `scout` | `claude-sonnet-5` | Open-ended search, but the blast radius is the smallest in the factory: its output is a candidate list a human reads, and a candidate cannot enter the benchmark without a full `/feature` round. |
| `refine` | `claude-sonnet-5` | Short, conversational, and human-checked at every turn — it asks at most three questions and the human picks which card enters the line. |

## Context
Model choice was previously implicit: no agent declared one, so every
agent inherited the interactive session's model and the whole factory
ran on whatever `/model` happened to be set to. The August ledger
shows the effect — 538 requests on `claude-opus-5` and 140 on
`claude-opus-4-8`, split by nothing more principled than when each
session was started.

The published architecture diagram already labelled the refresh
line's twelve researchers `claude-sonnet-5`. They were not running on
it. `refresh.yml` passes `--model claude-opus-5` to the session, and
a subagent with no `model:` inherits the session — so the diagram
documented a cost control that the agent files never implemented, and
every researcher in every round so far has run on Opus. Pinning
`claude-sonnet-5` in `researcher.md` makes the published claim true
for the first time rather than changing it.

The rule we settled on is not "cheap where possible." It is **spend
where a mistake is expensive and hard for the human to catch, and
save where the output is short, structured, or checked immediately by
a gate or by `npm run verify`.** That is why the reviewer stays on
Opus while the scout does not, even though the scout's task looks
harder in isolation: the scout's output is read by a human within
minutes, the reviewer's judgment is the thing the human is relying on.

Splitting the panel is what makes a per-lens model possible at all —
a subagent carries one model, so three models means three agents. It
also buys parallelism, and it gives the cost ledger three rows where
it had one, so the next round of this decision can be made from
measurements instead of estimates.

Two things were deliberately not done:

- **No agent runs on `claude-haiku-4-5`.** The nearest candidate was
  the security lens. Haiku 4.5 is half the price of Sonnet 5 on the
  cheapest agent in the line, so the saving is rounding error, and it
  is the one lens whose misses nothing downstream catches.
- **Full model IDs, not the `opus` / `sonnet` aliases.** An alias
  silently re-points when Claude Code's mapping moves, which would
  change what the factory runs on without a commit. `data/model-pricing.json`
  is keyed by ID and `npm run cost` flags any model missing from it,
  so pinning keeps the ledger honest — at the cost of a commit
  whenever we move to a newer model, which is the right place for
  that decision to be visible.

## Consequences
- Model choice is now a reviewable line in a diff, not a side effect
  of session state.
- The panel's lenses no longer see each other's reasoning inside one
  context. Cross-lens overlap — third-party origins land in both
  security and compliance — is handled by the orchestrator merging
  and deduplicating, which `/feature` Phase 3 now spells out.
- Three parallel lens agents each load the plan and the code they
  touch, so panel input tokens roughly triple. Two of the three run
  at Sonnet rates, so the round is still expected to cost less than
  the single Opus panel it replaces — but this is an estimate, and
  the next `npm run cost` measures it.
- The dominant cost in the ledger is the interactive orchestrator
  session ($73.69 of $97.69 in August), which has no frontmatter and
  is unaffected by any of this. Subagent tiering is the smaller lever
  of the two; naming that here so the next cost review starts from
  the right place.
