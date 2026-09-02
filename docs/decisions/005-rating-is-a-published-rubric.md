# ADR-005: The overall rating is a published rubric, published before it is used

Date: 2026-08-21
Status: accepted

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
| 4 | Deployment sovereignty | 15 | `eu-onprem`, `open-source` |
| 5 | Maturity | 15 | `ga-status`, `release-recency`, `sustained-cadence` |
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

## Amendments (2026-08-21, on first application)

Applying the rubric surfaced two things the draft got wrong. Both are
recorded here rather than silently absorbed.

**`breaking-change-history` is replaced by `sustained-cadence`.** The
draft named "breaking-change history" as a Maturity criterion and in the
same breath restricted Maturity to tier-A evidence. Those two rules
contradict each other: establishing a twelve-month breaking-change record
means reading migration guides and diffing majors, which is archaeology,
not a dated primary source. A criterion that cannot be evidenced at the
tier its own dimension demands would have been filled by judgment wearing
a citation — the exact failure ADR-002 exists to prevent. The three
Maturity criteria are therefore all read straight off tagged releases:

| Criterion | 2 | 1 | 0 |
| --- | --- | --- | --- |
| `ga-status` | major >= 1, or GA in vendor docs | pre-1.0, or GA with beta components | alpha / experimental |
| `release-recency` | latest stable <= 30 days | 31–90 days | > 90 days |
| `sustained-cadence` | >= 6 stable releases in trailing 90 days | 2–5 | <= 1 |

`ga-status` measures how far the product has come, `release-recency`
whether it is alive now, `sustained-cadence` whether it is consistently
alive. Rounding to a whole number happens once, on the exact total, and
ties round up: maestro's 82.50 publishes as 83. The unrounded total is
kept in `score.exact` so the arithmetic stays checkable.

**A criterion with no tier-A source makes the tool unrated, not zero.**
The draft never said what to do when the evidence does not exist. Scoring
absent evidence as 0 would publish "immature" on the strength of nothing,
which is not a neutral statement (CLAUDE.md rule 3); redistributing the
weight would give that tool a different denominator and break
comparability. So a tool whose Maturity cannot be evidenced at tier A
carries no overall rating at all, with the reason stated on the page.

This is not a proxy for being closed-source: Databricks Agent Bricks is
proprietary and satisfies tier A through dated platform release notes.
It bites only where a vendor publishes no dated release information of
any kind, and that absence is itself the finding.

**Dimension 4 is "deployment sovereignty", not "governance".** The draft
called it governance, which collides with a different and equally valid
meaning already on the page: Databricks Agent Bricks carries a "Best
Governance" badge for Unity Catalog lineage and access control. Dimension
4 measures neither of those — `eu-onprem` and `open-source` measure
whether you can run the thing yourself under a licence you control.
Leaving the draft's name would have published a rubric that scores
Databricks last on "governance" while a badge two lines above calls it
best, from two different definitions of one word.

## Amendment (2026-09-02, on the first contested matrix cell)

**`model-agnostic` scores what the operator can choose, not how the tool
reaches the model.**

The rubric listed `model-agnostic` among dimension 3's criteria and never
said what its three tiers mean. That was survivable while every tool either
talked to models directly or did not. It stopped being survivable with
Claude Squad, which does neither: it spawns other vendors' agent CLIs and
never selects a model itself. Two readings were both defensible and they
differ by two points on the published score. The 2026-08 and 2026-09 rounds
each flagged the cell and each correctly declined to move it — a criterion
with no published tiers cannot be applied mechanically, and applying it by
private judgment is what ADR-002 exists to prevent.

| Tier | Test | Published example |
| --- | --- | --- |
| 2 (`yes`) | the operator can point the tool at more than one vendor's models, and the vendor documents how | google-adk, via a LiteLLM bridge; claude-squad, via `-p <agent CLI>` |
| 1 (`partial`) | more than one model is in play but the operator cannot choose which; or multi-vendor support exists only as a `Planned` label, per the evidence standard above | manus-ai, "Multi-LLM internal" |
| 0 (`no`) | one vendor's models, with no documented way out | claude-sdk, "Claude-only" |

The mechanism is deliberately not part of the test. Native multi-provider
support, a router, a gateway, and spawning a third-party CLI are different
engineering, but this criterion sits in *Integration & interoperability*,
which asks what a tool can be connected to rather than how it connects.
Making the mechanism decide would already have contradicted google-adk,
which has held `yes` on a bridge since the rubric was first applied.

**Re-evaluated against all twelve tools, as CLAUDE.md rule 2 requires: no
tier moves.** Nine hold `yes`, manus-ai holds `partial` because its routing
is internal and unselectable, claude-sdk holds `no`. The rule codifies what
the matrix already published rather than re-scoring it — which is the right
outcome for an amendment that follows a contested cell instead of preceding
one. The check was against the published tiers and labels, not a
re-verification of each vendor's documentation; that is a refresh-round job,
and this amendment does not stand in for one.

**What this does not settle: the label.** `ms-agent` publishes "6 Providers"
while current vendor docs support 9, 11 or 8 depending on which list is
counted, and the 2026-09 round dropped the finding for want of a counting
rule. The tier is unaffected — ms-agent is `yes` at any of those counts — so
that is a label-accuracy question, not a scoring one, and it remains open.
