# Design: Automating the benchmark update process

Date: 2026-08-10
Status: proposed — awaiting approval

## Problem

The site is refreshed by a recurring market-research round. The changelog
records three so far (Mai 2026, 26. Mai 2026, Juli 2026). Each round is the
same manual sequence: research what changed across all tools, adjust scores,
feature-matrix cells, price cards and verdicts, write a changelog entry, then
mirror the whole thing into the English file.

Three properties of the current codebase make that sequence risky to automate:

1. **The data is duplicated prose.** `index.html` (2066 lines) and
   `index.en.html` (2019 lines) are 88% byte-identical — 1809 lines match
   exactly. Every score exists twice, in two files, as text.
2. **The feature matrix is positional.** 12 tools × 14 features = 168 cells.
   A cell is `<td><span class="chip chip-yes">Vollständig</span></td>` with no
   attribute identifying its tool. Correctness depends on counting columns, in
   both files. Column order also differs from the score grid: the score grid
   runs `… crewai, ms-agent, n8n …` while the matrix runs `… crewai, n8n,
   ms-agent …`, and the same swap occurs for `openai-sdk`/`claude-squad`.
   Anything that keys by position rather than by tool will silently corrupt data.
3. **There are no source citations.** Zero data points on the site carry a
   source. `CLAUDE.md` rule 1 requires one next to each. Automating data entry
   without addressing this scales an existing gap.

The current state is otherwise clean: all 12 scores agree between DE and EN,
and all 12 `score-bar-fill` widths match their score numbers.

## Goals

- A refresh round can be run as one command, with humans deciding what lands.
- DE/EN consistency and source coverage become mechanically checkable, not
  matters of reviewer attention.
- The research phase cannot write to the repository.
- No framework, no client-side rendering, no change to what the server serves.

## Non-goals

- Generating the HTML from data. Explicitly deferred; see "Rejected".
- Restructuring CSS, JS, or the comparison feature.
- Automating the merge. Both gates stay human, per `CLAUDE.md`.
- Translating prose automatically. Verdicts and changelog entries stay
  human-or-agent authored per language.

## Architecture: JSON asserts, HTML serves

`data/tools.json` becomes the source of truth for machine-checkable facts.
The HTML files remain the served artifact and are still edited directly.
`scripts/verify.mjs` proves the two agree.

This inverts the usual arrangement. JSON is not a template input — it is an
assertion about what the HTML must contain. The site keeps working if the
script is never run; the script is what makes an automated edit trustworthy.

```
research (read-only)  →  proposed diff  →  GATE 1  →  edit JSON + both HTML
                                                          ↓
                                        verify.mjs (JSON ⟷ DE ⟷ EN)  →  review  →  GATE 2
```

### Rejected: generating HTML from JSON

Templatizing two working 2000-line files is effectively a rewrite, and it
adds a permanent build step against `CLAUDE.md` rule 4. The payoff scales with
update frequency; actual cadence is roughly six rounds a year. At that rate the
per-round saving is small and the upfront risk is a broken site.

This is a deferral, not a dead end. Once `tools.json` exists and is proven
accurate against the HTML, generating from it is a contained follow-up.

### Rejected: client-side rendering from JSON

Removes the build step but takes the benchmark data out of the HTML source.
For a public comparison site whose value depends on being found and cited,
losing indexable content is a bad trade.

## Component 1 — `data/tools.json`

Keyed by the existing `data-tool` slug so it joins to the markup without a
lookup table: `maestro`, `langgraph`, `google-adk`, `strands`, `databricks`,
`crewai`, `n8n`, `ms-agent`, `claude-sdk`, `claude-squad`, `openai-sdk`,
`manus-ai`.

Three tiers of data, distinguished by how they can be checked:

**Tier A — language-neutral, hard-asserted.** Score, score-bar width, matrix
cell state (`yes` | `partial` | `no`), presence of each tool in each section.
These must be identical in both files; any difference is a defect.

**Tier B — translated, asserted as exact strings.** Chip labels, price row
labels and values, price notes. Stored as `{de, en}` pairs. The verifier checks
the HTML matches the stored string byte-for-byte. This catches drift without
the script needing to understand German or currency formatting.

**Tier C — not asserted.** Verdict bodies, changelog entries, subtitles,
descriptors. Free prose, reviewed by humans.

```jsonc
{
  "meta": {
    "edition": "2026",
    "asOf": {                        // rendered stamp, stored per language so
      "de": "Juli 2026",             // the verifier needs no month-name table
      "en": "July 2026"
    },
    "features": [                    // matrix row order, 14 entries
      { "key": "multi-agent-parallel",
        "label": { "de": "Multi-Agent Parallel", "en": "Multi-Agent Parallel" },
        "desc":  { "de": "Gleichzeitige Ausführung", "en": "Concurrent execution" } }
      // … desktop-gui, playbooks, mobile-remote, git-worktrees, group-chat,
      //    mcp-support, open-source, cli-cicd, observability, hitl,
      //    eu-onprem, model-agnostic, learning-curve
    ]
  },
  "tools": {
    "langgraph": {
      "name": "LangGraph",
      "url": "https://www.langchain.com/langgraph",
      "score": {
        "value": 89,
        "source": "https://changelog.langchain.com/…",
        "checked": "2026-07-14"
      },
      "matrix": {
        "multi-agent-parallel": {
          "state": "yes",
          "label": { "de": "Vollständig", "en": "Full" },
          "source": "https://langchain-ai.github.io/langgraph/…",
          "checked": "2026-07-14"
        }
        // … one entry per feature key
      },
      "price": {
        "main":  { "de": "€0", "en": "€0" },
        "note":  { "de": "Open Source (MIT) · Self-hosted",
                   "en": "Open Source (MIT) · Self-hosted" },
        "rows": [
          { "label": { "de": "LangSmith Plus", "en": "LangSmith Plus" },
            "value": { "de": "~€39/Mo.", "en": "~€39/mo" },
            "source": "https://www.langchain.com/pricing",
            "checked": "2026-07-14" }
        ]
      }
    }
  }
}
```

### Sourcing and the legacy backfill

Every Tier A and Tier B data point carries `source` (URL) and `checked` (date).
Existing values have neither, and inventing citations for them would be the
worst possible outcome. So:

- Legacy values are backfilled with `"source": null,
  "provenance": "legacy-unsourced"`.
- The verifier **reports** unsourced coverage but does not fail on it.
- The verifier **fails** when a value changes without gaining a real source.

That makes the enforced rule "no *changed* value without a source" — which is
what `CLAUDE.md` rule 1 actually needs to prevent bad data entering — while
leaving the historical gap visible and closeable over time rather than
papered over.

## Component 2 — `scripts/verify.mjs`

Node, no dependencies, regex/string extraction over the two HTML files. Not a
DOM parser: the markup is machine-generated-regular and a parser is a
dependency this project does not need.

Checks, each reporting file, tool, and field on failure:

1. Every score in each HTML equals `tools[key].score.value`.
2. Every `score-bar-fill` width equals its score.
3. DE and EN agree on all Tier A values.
4. Matrix column order is read from `<th data-tool>`, and each cell is
   attributed to its tool by that mapping — never by fixed index.
5. Each matrix cell's `chip-{yes,partial,no}` class equals the recorded state;
   each chip's text equals the recorded per-language label.
6. Price cards: order, labels, values, and notes match per language.
7. Tool sets match across all four sections and both files — a tool cannot be
   in the matrix but missing from pricing.
8. `meta.asOf.de` equals the `Stand: …` stamp in `index.html` and
   `meta.asOf.en` equals the `As of: …` stamp in `index.en.html`, and both
   equal their file's newest `news-date`. (Today: `Juli 2026` / `July 2026`.)
9. Source coverage summary: count of data points with and without sources.
10. Changed-without-source detection, by diffing `tools.json` against `HEAD`.

Exit non-zero on any failure. Output is a list of concrete mismatches, not a
boolean.

## Component 3 — markup affordances

Two small additions, no visual change:

- `data-tool="<key>"` on each `.price-card`. They are currently identified only
  by the display text in `.price-tool`, which is fragile and language-adjacent.
- `data-feature="<key>"` on each matrix row's first `<td>`. Makes row identity
  explicit rather than inferred from the feature name string.

Both make the verifier simpler and agent edits addressable. Neither changes
rendering.

## Component 4 — the `/refresh` pipeline

A third line alongside `/feature` and `/hotfix`, in
`.claude/commands/refresh.md`, orchestrating a new read-only `researcher`
subagent plus the existing `implementer` and `reviewer`.

**Phase 1 — Research.** One `researcher` subagent per tool, dispatched in
parallel. Each gets one tool, its current `tools.json` entry, and its official
sources. Each returns findings as structured deltas with a source URL and date
per claim. Tools: `Read`, `Grep`, `Glob`, `WebFetch`, `WebSearch`. No write
tools — the hallucination-prone phase cannot reach the repository.

**Phase 2 — Triage.** The orchestrator consolidates findings into a proposed
diff against `tools.json`. Any claim without a resolvable source URL is
dropped and listed as dropped, never guessed. Score changes must state which
criterion moved and why.

**GATE 1 — Human approval.** Present the proposed diff grouped by tool: field,
old → new, source, and the reasoning for score movements. Also present dropped
claims. Stop. Only an explicit go continues.

**Phase 3 — Implement.** `implementer` applies approved changes: `tools.json`
first, then both HTML files, then a changelog entry in both languages, then the
`Stand:` / `As of:` stamp. Plan steps marked done as they complete, per
`CLAUDE.md`.

**Phase 4 — Verify.** `scripts/verify.mjs` must exit zero. Failures go back to
the implementer, not to the human.

**Phase 5 — Review.** `reviewer` checks that every changed value traces to a
source, that scoring stayed consistent across tools (`CLAUDE.md` rule 2), and
that no promotional language crept in (rule 3). Drafts the PR description.

**GATE 2 — Merge.** Human merges. Agents never do.

Trigger is manual to start. A scheduled monthly run is a later addition, once
the pipeline has been through a real round.

## Component 5 — CI and deploy (phase 2)

- `.github/workflows/verify.yml` — run `verify.mjs` on every PR and push.
- `.github/workflows/pages.yml` — publish to GitHub Pages on merge to `main`.

Small once the verifier exists. Deliberately second: the verifier is useful
locally on day one, and wiring CI before the data model settles means
rewriting it.

## Failure modes

| Failure | Handling |
|---|---|
| Researcher finds nothing for a tool | Recorded as "no change found, checked <date>". Not an error. |
| Researcher returns a claim with no source | Dropped at triage, listed in the gate report. |
| Sources disagree | Both surfaced at the gate. Human decides. No automatic tie-break. |
| Verifier fails after implementation | Back to implementer. Two rounds, then escalate. |
| `tools.json` and HTML diverge outside a refresh | Verifier catches on next PR. |
| A tool is added or removed | Requires re-evaluating all tools against the criteria (`CLAUDE.md` rule 2). Out of scope for `/refresh`; goes through `/feature`. |
| Score change with no criterion cited | Reviewer blocks. |

## Verification of this work

The design is correct when:

1. `node scripts/verify.mjs` exits zero against the current unmodified site.
   This is the baseline and must hold before any pipeline work — it proves the
   backfill is accurate rather than merely plausible.
2. Deliberately changing one score in `index.html` only makes it exit non-zero
   naming that tool and file.
3. Deliberately changing one matrix chip state in `index.en.html` only makes it
   exit non-zero naming that tool and feature.
4. Changing a value in `tools.json` without adding a source makes it exit
   non-zero.
5. A full `/refresh` dry run produces a gate report with per-claim sources and
   writes nothing before approval.

## Phasing

**Phase 1 — Foundation.** Backfill `tools.json` from the current HTML, add the
markup affordances, write `verify.mjs`, get criterion 1 green. Own gate.
The backfill is the real cost: 12 tools × ~16 fields, and its accuracy is what
everything else rests on.

**Phase 2 — Pipeline.** `researcher` subagent, `/refresh` command, dry run.

**Phase 3 — CI/deploy.** The two workflows.

Each phase is a separate PR and a separate human gate.

## Decisions to record

If approved, two ADRs in `docs/decisions/`:

- **JSON asserts, HTML serves.** Why the data is duplicated on purpose and
  verified, rather than generated.
- **Sourcing applies to changes, not history.** Why legacy values are marked
  `legacy-unsourced` instead of blocking the pipeline or being given invented
  citations.

## Open risks

- The backfill may reveal current values that no source supports. That is
  information, not a blocker — they get marked `legacy-unsourced` and become
  candidates for the next round. It may be uncomfortable reading.
- Tier B exact-string matching will produce failures on harmless copy edits.
  Acceptable: the fix is updating `tools.json`, which is the point.
- Parallel researchers cost tokens. 12 agents per round is the price of clean
  contexts; the alternative is one agent losing track across 12 tools.
- `agentic-workflow/` currently duplicates `.claude/` and `CLAUDE.md` exactly.
  Unclear which is authoritative. Not addressed here, but new pipeline files
  will need to go in whichever one is real — worth resolving before Phase 2.
