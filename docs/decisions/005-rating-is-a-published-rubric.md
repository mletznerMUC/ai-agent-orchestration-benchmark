# ADR-005: The overall rating is a published rubric, published before it is used

Date: 2026-08-21
Status: proposed

## Decision
The `/100` overall rating is defined as a weighted sum over six published
dimensions, each decomposed into criteria that are evidenced one at a
time. Three rules bind it:

1. **The rubric is published before any score is derived from it.** The
   dimension table below, its weights, and the evidence standard ship on
   the site as a Methodology section. A score computed from an
   unpublished rubric is the status quo under a better name.
2. **Every criterion carries its own source.** A criterion is scored
   0 / 1 / 2 (absent / partial / full) and, per ADR-002, cannot *move*
   without a source URL and a `checked` date. Where a criterion already
   exists as a matrix cell, the matrix cell **is** the input — it is not
   re-judged separately.
3. **Until the re-derivation lands, the published numbers are labelled
   editorial on the page.** They are not retroactively deleted or
   silently recomputed.

### Dimensions and weights

| # | Dimension | Weight | Criteria |
| --- | --- | --- | --- |
| 1 | Orchestration capability | 25 | `multi-agent-parallel`, `playbooks`, `group-chat`, `git-worktrees` |
| 2 | Operability | 20 | `observability`, `hitl` |
| 3 | Integration & interoperability | 15 | `mcp-support`, `model-agnostic`, `cli-cicd` |
| 4 | Deployment & governance | 15 | `eu-onprem`, `open-source` |
| 5 | Maturity | 15 | GA status, release cadence, breaking-change history |
| 6 | Accessibility | 10 | `learning-curve`, `desktop-gui`, `mobile-remote` |

Dimensions 1–4 and 6 draw entirely on the fourteen existing matrix
criteria, so they are already sourced to whatever degree the matrix is.
Dimension 5 is new and holds the judgment the matrix never captured.

### Evidence standard

Ranked; a criterion is scored from the best tier available, and the tier
is recorded with the citation:

- **A — primary, dated.** Vendor changelog, release notes, tagged
  release, `LICENSE` file, versioned API reference.
- **B — primary, undated.** Vendor documentation without a version or
  date stamp.
- **C — observed.** Reproducible hands-on check, recorded with the
  version tested.

Vendor blog posts, marketing pages, roadmaps, conference talks and
third-party summaries are **not** evidence for a criterion. A roadmap
entry may justify `partial` only where the matrix label says so in words
(the existing `Planned` labels), never `full`.

Dimension 5 takes tier A only. It is the softest dimension and therefore
gets the hardest bar: "mature" claimed from a blog post is the exact
failure ADR-002 was written to prevent.

## Context
The site publishes an "Overall Rating / 100" for twelve tools as the most
prominent number on the page, and the ranking is built from it. Nothing
defined it. All twelve carry `provenance: "legacy-unsourced"` with a null
source; none of the twelve is among the cited data points.
`scripts/verify.mjs` checks only that the number is transcribed
identically into both HTML files and that the bar width matches it — that
it is copied faithfully, not that it is justified.

Meanwhile `CLAUDE.md` rule 2 and three agent definitions all appeal to
"the published criteria" as though the artifact existed:
`researcher.md` forbids moving a score without naming the criterion that
moved, and `scout.md` forbids proposing a score at all because scoring
"requires evaluating the tool against every published criterion". No such
document is in the repository. The rule therefore could not be satisfied
or violated, and the 2026-08 round recorded the predictable outcome: "No
score value moved this round. No researcher proposed a score change that
named a published criterion."

The fourteen-item feature matrix was the only candidate rubric, and it is
demonstrably not the source of the numbers. Scoring the matrix 2/1/0 and
ranking by it disagrees with the published order outright:

| Tool | Published | Matrix coverage | Matrix-implied |
| --- | --- | --- | --- |
| maestro | 84 | 26/28 — best of twelve | 93 |
| langgraph | 89 — top, "Best Overall" | 19/28 | 68 |
| databricks | 85 | 19/28 | 68 |
| n8n | 79 | 22/28 | 79 |
| claude-squad | 72 | 13/28 — worst of twelve | 46 |

Maestro leads the matrix and places fifth; LangGraph is tied for
third-worst coverage and leads the rating. No weighting of the fourteen
columns reproduces the published order, so the scores encode maturity and
ecosystem judgments held outside the recorded data. That is a defensible
thing to weigh — dimension 5 exists to hold it — but not while it is
unwritten and unweighted.

Two options were rejected. **Deriving the score purely from the matrix**
is mechanical and fully sourced today, but it would silently discard the
maturity judgment and reorder the entire benchmark on an argument nobody
made. **Backfilling citations onto the twelve existing numbers** is the
failure ADR-002 already named: it "looks like rigour".

## Consequences
The re-derivation of all twelve scores against this rubric is `/feature`
work behind the plan-approval gate, not a data refresh — CLAUDE.md rule 2
means adding a criterion requires re-evaluating every tool, and this adds
a dimension to every tool at once. Dimension 5 has to be researched from
scratch for twelve tools before a single score can be recomputed.

Scores will move, and some ranking changes will be large: the gap between
the published order and matrix coverage is where the movement will land.
That is the point, and it is the reason the rubric ships before the
numbers rather than alongside them — publishing both together would make
every change unfalsifiable.

Until then the page carries a provenance note stating that the rating is
editorial and is not computed from the matrix, so the `/100` stops
implying a rubric that is not yet published. `verify` does not check that
note; it is prose, not an asserted data point. Extending `tools.json` and
the verifier to cover per-criterion scores and their tiers is follow-on
work and is deliberately not started here — a second uncrosschecked copy
of the rating data would be worse than none.

Should the rubric be rejected, the provenance note stands on its own: the
scores are unsourced whether or not this is the rubric that fixes them.
