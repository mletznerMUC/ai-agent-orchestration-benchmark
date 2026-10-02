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
