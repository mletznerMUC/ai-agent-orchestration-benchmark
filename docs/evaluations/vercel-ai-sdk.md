# Evaluation record — Vercel AI SDK (`vercel-ai-sdk`)

Evaluated for addition to the benchmark under the plan in `PLAN.md`
(`feature/vercel-ai-sdk`, Gate 1 approved 2026-10-02).

Evidence tiers used here are the ones published in
`docs/decisions/005-rating-is-a-published-rubric.md`:

- **A** — primary, dated (changelog, release notes, tagged release, `LICENSE`,
  versioned API reference).
- **B** — primary, undated (vendor documentation without a version or date
  stamp).
- **C** — observed (reproducible hands-on check, recorded with the version
  tested).

Vendor blog posts, marketing pages, roadmaps and third-party summaries are not
evidence here.

## Category fit

The question this gate has to answer is narrow. The AI SDK is widely used as a
provider abstraction and a UI streaming layer, and neither of those is
orchestration. The scout bar asks for planning, delegation, multi-step tool
use, or multi-agent coordination. The table below records what the current
documentation documents, not what the product is reputed to do.

| Bar | Verdict | Evidence | Source | Checked |
| --- | --- | --- | --- | --- |
| 1. In category | **pass** | The `ai` package exports a `ToolLoopAgent` class documented as "capable of generating text, streaming responses, and using tools over multiple steps (a reasoning-and-acting loop) … can iteratively invoke tools, collect tool results, and decide next actions until completion or user approval is required". That is multi-step tool use with a stopping condition. Delegation is documented separately: "A subagent is an agent that a parent agent can invoke. The parent delegates work via a tool, and the subagent executes autonomously before returning a result." | https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent and https://ai-sdk.dev/docs/agents/subagents | 2026-10-02 |
| 2. Real and usable | **pass** | Published on the public npm registry as the `ai` package, latest `7.0.127`; public documentation with installable quickstarts. | https://registry.npmjs.org/ai (`dist-tags.latest`) and https://ai-sdk.dev/docs/getting-started/nodejs | 2026-10-02 |
| 3. Alive | **pass** | `ai@7.0.127` published 2026-10-01T19:20:23Z, one day before the check; the matching tagged release `ai@7.0.127` is dated 2026-10-01 on the repository releases page. | https://registry.npmjs.org/ai (`time`) and https://github.com/vercel/ai/releases | 2026-10-02 |
| 4. Non-trivial signal | **pass** | 33,210,532 downloads of the `ai` package in the week 2026-09-24 to 2026-09-30, as reported by the npm downloads API. | https://api.npmjs.org/downloads/point/last-week/ai | 2026-10-02 |

**Overall verdict: the Vercel AI SDK clears all four scout bars, and the
in-category bar specifically, on the strength of the documented
`ToolLoopAgent` multi-step tool loop and the documented subagent delegation
pattern; the pipeline continues to step 2.**

What this verdict does *not* say: it does not say the AI SDK orchestrates
agents as well as, or in the same way as, any tool already in the benchmark.
The bar is a category test, not a quality test. How far the documented
capability goes is what the matrix and the rubric below measure.

## Version baseline

| Item | Value |
| --- | --- |
| Scored artefact | the npm package `ai` |
| Version pinned | `7.0.127` |
| Published | 2026-10-01T19:20:23.718Z |
| Authoritative source for the pin | https://registry.npmjs.org/ai — the `dist-tags.latest` field, cross-read with the `time` map for the publication date |
| Corroborating source | https://github.com/vercel/ai/releases — carries the matching tagged release `ai@7.0.127`, dated 2026-10-01 |
| Licence | Apache-2.0 (`license` field of version `7.0.127` in the registry document; `LICENSE` at https://github.com/vercel/ai/blob/main/LICENSE) |
| Runtime requirement | `engines.node: ">=22"` for `ai@7.0.127` (registry document) |
| Evaluation date | 2026-10-02 |

**The npm registry is authoritative for the pin.** The repository publishes one
tagged release per package in a monorepo, so the releases page carries tags for
`@ai-sdk/react`, `@ai-sdk/workflow` and others alongside `ai@…`. The registry's
`dist-tags.latest` for the `ai` package is the unambiguous statement of which
version an installer gets, which is the artefact decision D1 scopes this
evaluation to. The releases page is read as corroboration and is the tier-A
source for the maturity criteria.

**2026-10-02 is the `checked` value for every citation added by this feature** —
every matrix cell, every price row, the score and each maturity criterion. No
existing tool's `checked` date is touched.

### Scope of this evaluation — decided at Gate 1, 2026-10-02 (D1)

**EN:** For the Vercel AI SDK the scored artefact is the `ai` package only.
Provider packages, the AI Gateway and the Vercel hosted platform are not
scored.

**DE:** Für das Vercel AI SDK ist ausschließlich das Paket `ai` bewertet.
Provider-Pakete, das AI Gateway und die gehostete Vercel-Plattform sind nicht
bewertet.

Two consequences of D1 that the scoring below applies consistently:

- A capability the `ai` package provides itself scores on its own merits.
- A capability that requires installing a further package alongside `ai` is
  scored `partial`, not `yes`, and the chip label names the package so a reader
  can see which one. This is how `mcp-support` (`@ai-sdk/mcp`) and
  `observability` (`@ai-sdk/otel`) are treated. Both of those packages are
  first-party and live in the same repository; `partial` records that they are
  outside the scored artefact, not that the capability is incomplete.

## Matrix

All fourteen published criteria, judged against the D1 artefact (`ai@7.0.127`)
only. `checked` is 2026-10-02 for every row. Tiers are recorded here and
nowhere else (D2) — `data/tools.json` matrix cells carry no `tier` field.

| # | Criterion | State | Label DE | Label EN | Tier | Source | Justification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `multi-agent-parallel` | `yes` | Subagents | Subagents | C | `docs/hands-on/vercel-ai-sdk/2026-10-02-log.md` | The docs describe parallel work as a caller-written `Promise.all` over several generations and as spawning "multiple subagents to research different areas simultaneously", which is a pattern rather than a documented execution feature; the docs alone did not settle whether several agent loops really interleave in one process. The hands-on run settles it: two `ToolLoopAgent` instances ran concurrently in one process with their steps interleaved, and a parent agent delegated to a subagent through a tool. |
| 2 | `desktop-gui` | `partial` | DevTools (lokal) | DevTools (local) | B | https://ai-sdk.dev/docs/ai-sdk-core/devtools | A web-based inspection UI exists, but the docs state it "is intended for local development only. Do not use in production environments", and it ships in the separate `@ai-sdk/devtools` package. There is no native desktop application. |
| 3 | `playbooks` | `yes` | Agent Loop | Agent Loop | B | https://ai-sdk.dev/docs/agents/loop-control | The `ai` package runs an autonomous tool loop with documented stopping conditions: `stopWhen` with the built-ins `isStepCount(count)`, `hasToolCall(...)` and `isLoopFinished()`, plus `prepareStep` to change model, tools or messages between steps. `ToolLoopAgent` defaults to `isStepCount(20)`. |
| 4 | `mobile-remote` | `no` | Nein | No | B | https://ai-sdk.dev/docs/getting-started/expo | The only mobile documentation covers building an app *with* the SDK. Nothing in the documentation offers remote control of a running agent from a phone. |
| 5 | `git-worktrees` | `no` | Nein | No | B | https://ai-sdk.dev/llms.txt | The complete documentation index contains no git worktree feature. Recorded as an absence found by searching the full index, not inferred. |
| 6 | `group-chat` | `partial` | Subagent-Delegation | Subagent Delegation | B | https://ai-sdk.dev/docs/agents/subagents | Documented communication is one-directional delegation: "The parent delegates work via a tool, and the subagent executes autonomously before returning a result." No documented peer-to-peer conversation between agents. Same tier and label family as `claude-sdk`, which is scored `partial` on the same pattern. |
| 7 | `mcp-support` | `partial` | @ai-sdk/mcp | @ai-sdk/mcp | B | https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools | A full MCP client is documented — HTTP, SSE and stdio transports, tools, resources, prompts, completions and elicitation — but `createMCPClient` is imported from `@ai-sdk/mcp`, which is not among the three runtime dependencies of `ai@7.0.127` (`@ai-sdk/gateway`, `@ai-sdk/provider`, `@ai-sdk/provider-utils`). Per D1 that package is outside the scored artefact, so the cell is `partial` and the label names it. |
| 8 | `open-source` | `yes` | Apache 2.0 | Apache 2.0 | A | https://github.com/vercel/ai/blob/main/LICENSE | `LICENSE` in the repository; the `license` field of `ai@7.0.127` in the registry document reads `Apache-2.0`. |
| 9 | `cli-cicd` | `yes` | TypeScript SDK | TypeScript SDK | B | https://ai-sdk.dev/docs/getting-started/nodejs | The documented Node.js quickstart runs the agent loop from a plain script with no UI and no server, which is what headless automation needs. Scored the same way as `openai-sdk` ("Python SDK") and `claude-sdk` ("Python + TS"). |
| 10 | `observability` | `partial` | @ai-sdk/otel | @ai-sdk/otel | B | https://ai-sdk.dev/docs/ai-sdk-core/telemetry | `registerTelemetry()` is exported from `ai` and, once an integration is registered, supported calls emit telemetry by default with documented `gen_ai.usage.*` attributes. But the docs state "OpenTelemetry span collection requires the `@ai-sdk/otel` package", which is outside the D1 artefact. `partial` records the package boundary, not a gap in the instrumentation. |
| 11 | `hitl` | `yes` | Tool Approvals | Tool Approvals | B | https://ai-sdk.dev/docs/agents/tool-approvals | `toolApproval` on `ToolLoopAgent` is exported from `ai` and documented with four statuses (`not-applicable`, `approved`, `denied`, `user-approval`); on `user-approval` "the agent returns a `tool-approval-request` instead of executing the tool". Per-tool maps, per-tool functions and one generic policy function are all documented. |
| 12 | `eu-onprem` | `yes` | Self-hosted | Self-hosted | B | https://ai-sdk.dev/providers/openai-compatible-providers/lmstudio | `ai` is a library installed into the operator's own runtime, and the docs cover pointing it at an OpenAI-compatible endpoint the operator runs themselves (LM Studio). Nothing in the package requires Vercel-hosted infrastructure. Scored the same way as the other self-hostable libraries in the benchmark (`langgraph`, `crewai`, `claude-sdk`). See the caveat below. |
| 13 | `model-agnostic` | `yes` | Provider-agnostisch | Provider-agnostic | B | https://ai-sdk.dev/docs/foundations/providers-and-models | ADR-005's 2026-09-02 amendment scores what the operator can choose, not how the tool reaches the model: tier 2 is "the operator can point the tool at more than one vendor's models, and the vendor documents how". The providers page documents first-party providers for OpenAI, Anthropic, Google, Mistral, Amazon Bedrock, Azure, xAI, Cohere and others, plus an OpenAI-compatible route. No count is published in the label, because the benchmark has no settled counting rule (ADR-005, "What this does not settle: the label"). |
| 14 | `learning-curve` | `yes` | Niedrig | Low | B | https://ai-sdk.dev/docs/getting-started/nodejs | A published quickstart reaches a working tool-calling agent in a single file with one dependency and one provider key. Deliberately labelled "Low" rather than "Very Low": `ai@7.0.127` requires Node >= 22, the surface includes `stopWhen`/`prepareStep`/`toolApproval`/`runtimeContext`, and the capabilities above are spread across several packages. This criterion is a judgement anchored on the published quickstart and is the softest cell in the row. |

### `pending hands-on`

The list the step-4 hands-on work took as its input:

- `multi-agent-parallel`

Every other criterion was settled from the documentation. The list is now
empty: criterion 1 is settled by the tier-C log cited in its row.

Per D3, the tier-C `source` value in `data/tools.json` is the repo-relative
path `docs/hands-on/vercel-ai-sdk/2026-10-02-log.md`. The published pages link
the same artefacts as GitHub blob URLs, because a repo-relative `.md` path is
not a served page:

- log — https://github.com/mletznerMUC/ai-agent-orchestration-benchmark/blob/main/docs/hands-on/vercel-ai-sdk/2026-10-02-log.md
- script — https://github.com/mletznerMUC/ai-agent-orchestration-benchmark/blob/main/docs/hands-on/vercel-ai-sdk/run.mjs

### Caveats recorded rather than scored around

- **`eu-onprem`.** The `ai` package runs wherever the operator runs it, but
  inference goes wherever the configured provider points. If a model is named
  by a plain string such as `"anthropic/claude-sonnet-5.5"`, the request is
  routed by `@ai-sdk/gateway`, which is a runtime dependency of `ai@7.0.127`
  and, per D1, out of scope. The `yes` therefore means "the library can be run
  and pointed at an operator-controlled endpoint", not "every default path
  stays on the operator's infrastructure".
- **Why `model-agnostic` is `yes` while `mcp-support` and `observability` are
  `partial`.** `model-agnostic` is the one criterion with a published tier
  table, and that table says the mechanism does not decide the tier — which is
  why `google-adk` holds `yes` on an external LiteLLM bridge. The other two
  criteria have no such published rule, so the D1 artefact boundary is applied
  to them as written.

## Pricing

| Row | DE | EN | Tone | Source | Checked |
| --- | --- | --- | --- | --- | --- |
| Bibliothek / Library | €0 | €0 | `free` | https://www.npmjs.com/package/ai | 2026-10-02 |
| Lizenz / License | Apache 2.0 | Apache 2.0 | `free` | https://github.com/vercel/ai/blob/main/LICENSE | 2026-10-02 |
| Modellnutzung / Model usage | Nach Provider-Tarif | At the provider's rates | `default` | https://ai-sdk.dev/docs/foundations/providers-and-models | 2026-10-02 |

Card fields:

- `type`: "Open-Source TypeScript-SDK" / "Open-source TypeScript SDK"
- `main`: "€0" / "€0"
- `note`: "Apache 2.0 · ai 7.0.127 · Modellkosten beim Provider" /
  "Apache 2.0 · ai 7.0.127 · model costs billed by the provider"

Vercel publishes no list price for the `ai` package itself: it is an
Apache-2.0 package on the public npm registry, so the only cost the scored
artefact carries is the cost of the models the operator points it at, which is
set by that provider and not by this artefact. AI Gateway pricing and Vercel
platform pricing are out of scope per D1 and are deliberately not reproduced
on the price card.

## Rubric

ADR-005 dimensions and weights. Each criterion scores 2 (`yes`), 1 (`partial`)
or 0 (`no`); dimensions 1–4 and 6 take the matrix cell above as the input
(ADR-005 rule 2) and are not re-judged here. No criterion in the matrix table
is still marked `pending hands-on`.

| # | Dimension | Weight | Criteria (score) | raw / max | points = weight·raw/max |
| --- | --- | --- | --- | --- | --- |
| 1 | Orchestration capability | 25 | `multi-agent-parallel` 2, `playbooks` 2, `group-chat` 1, `git-worktrees` 0 | 5 / 8 | 25·5/8 = **15.625** |
| 2 | Operability | 20 | `observability` 1, `hitl` 2 | 3 / 4 | 20·3/4 = **15** |
| 3 | Integration & interoperability | 15 | `mcp-support` 1, `model-agnostic` 2, `cli-cicd` 2 | 5 / 6 | 15·5/6 = **12.5** |
| 4 | Deployment sovereignty | 15 | `eu-onprem` 2, `open-source` 2 | 4 / 4 | 15·4/4 = **15** |
| 5 | Maturity | 15 | `ga-status` 2, `release-recency` 2, `sustained-cadence` 2 | 6 / 6 | 15·6/6 = **15** |
| 6 | Accessibility | 10 | `learning-curve` 2, `desktop-gui` 1, `mobile-remote` 0 | 3 / 6 | 10·3/6 = **5** |

**Arithmetic, checked by hand.**

```
15.625 + 15 + 12.5 + 15 + 15 + 5 = 78.125
25·5/8 = 125/8 = 15.625
15·5/6 = 75/6  = 12.5
10·3/6 = 30/6  = 5
```

- `score.exact` = **78.125**
- `score.value` = floor(78.125 + 0.5) = floor(78.625) = **78**

The tool is **rated**: every maturity criterion carries a tier-A source, so
the unrated rule does not apply.

### Maturity (tier A only)

Read from dated, tagged releases of the D1 artefact. Sources, both checked
2026-10-02:

- https://github.com/vercel/ai/releases — tagged releases, each dated
- https://registry.npmjs.org/ai — the `time` map, which carries a publication
  timestamp per published version of the `ai` package

| Criterion | Score | Reading | Tier |
| --- | --- | --- | --- |
| `ga-status` | 2 | Latest stable major is `7` — major >= 1. `7.0.0` was published 2026-06-25. | A |
| `release-recency` | 2 | Latest stable `7.0.127` published 2026-10-01, i.e. 1 day before the evaluation date — inside the <= 30 day band. | A |
| `sustained-cadence` | 2 | Far more than 6 stable releases in the trailing 90 days. | A |

**The trailing 90-day window** runs 2026-07-04 to 2026-10-02 (the step-2
evaluation date). Counting only semver-stable versions of the `ai` package —
no `-canary`, `-beta` or `-alpha` tags:

| Month in window | `7.x` stable | `6.x` stable (maintenance line) |
| --- | --- | --- |
| 2026-07 (from the 4th) | 32 | 34 |
| 2026-08 | 35 | 53 |
| 2026-09 | 36 | 47 |
| 2026-10 (to the 2nd) | 1 | 1 |
| **Total** | **104** | **135** |

The current line alone contributes 104 stable releases, first `7.0.15`
(2026-07-04T06:10:42Z), last `7.0.127` (2026-10-01T19:20:23Z). The threshold
for a score of 2 is 6, so the criterion is not close to its boundary and the
exact count does not have to be litigated. The list is reproducible from the
registry document: take `time`, keep keys matching `^\d+\.\d+\.\d+$`, keep
timestamps inside the window.

### Descriptor and ranking

- `descriptor`: "Tool-Loop-SDK · TypeScript" (DE and EN).
- At 78 the tool sits between `langgraph` (81) and `claude-sdk` (76) in the
  published order. No existing tool's score, rubric or rank value is changed
  by this addition; only the positions around it in the published grid shift,
  because the grid is laid out in rank order.
