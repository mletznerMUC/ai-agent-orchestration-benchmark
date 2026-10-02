# ADR-012: Hands-on evidence has a place, a shape and a scope

Date: 2026-10-02
Status: accepted

## Decision
Adding Vercel AI SDK to the benchmark produced the first tier-C evidence the
project has published. Markus settled five questions about it at Gate 1 on
2026-10-02 ("go default and make it transparent for the user"). This ADR
records them so the next tool addition does not re-open them. It records
decisions already made; it makes none.

**D1 — The scored artefact is named, and it is the package.** For Vercel AI
SDK the scored artefact is the `ai` package only. Provider packages, the AI
Gateway and the Vercel hosted platform are not scored. *(Decided at Gate 1,
2026-10-02.)* Generally: an evaluation names the artefact it scores, and a
capability that requires installing a further package beside that artefact is
scored `partial`, not `yes`, with the chip label naming the package.

**D4 — Hands-on artefacts live in `docs/hands-on/<tool>/`**, kept as a tree
separate from `docs/evaluations/<tool>.md`. *(Decided at Gate 1, 2026-10-02.)*
The directory holds the reproducer script, its own `package.json` and
committed `package-lock.json` pinning the exact version evaluated (exact, no
`^`), and one log file per run date, `YYYY-MM-DD-log.md`.

The log format, which logs cite instead of restating:

- a header linking this ADR as the source of the format;
- a table of what was tested: package, exact version, model, runtime, date,
  script;
- the exact commands;
- the verbatim output, with any part of it that varies between runs called
  out as varying;
- one section per observation, each stating its inputs, what was observed,
  what it does **not** show, and the criterion and state it supports;
- observations that only corroborate a criterion already settled from
  documentation are labelled "not decisive", so the tier recorded in the
  evaluation stays the best tier available (ADR-005);
- a closing statement that no credential appears in the script or the log.

**D3 — A tier-C `source` is the repo-relative path to the log file**, for
example `docs/hands-on/vercel-ai-sdk/2026-10-02-log.md`. *(Decided at Gate 1,
2026-10-02.)* `scripts/verify.mjs` only checks that `source` is truthy, so a
path passes. The published pages link the same artefacts as GitHub blob URLs
instead, because a repo-relative `.md` path is not a served page. Those blob
URLs are branch- and path-sensitive and have to be updated if a log is ever
moved or renamed.

**D2 — Matrix cells carry no `tier` field.** Evidence tiers live in
`docs/evaluations/<tool>.md` and nowhere else. *(Decided at Gate 1,
2026-10-02.)* This follows ADR-005's Consequences, which defers extending
`tools.json` and the verifier to per-criterion tiers as follow-on work.

**D6 — The published pages disclose scope, tier-C cells and what the as-of
stamp means.** *(Decided at Gate 1, 2026-10-02.)* A tool addition writes, in
both languages: which artefact was scored and what was not; the exact version
and the checked date; which matrix criteria rest on hands-on evidence, named
by their published row labels, with links to the log and the reproducer; and,
in the changelog entry, that the new as-of stamp reflects that addition only
and that the other tools were last checked at their own `checked` dates. This
is a standing expectation for future additions, not a one-off.

**Non-goal — nothing under `docs/hands-on/` is wired into anything.** It is
never referenced by the root `package.json`, by any file in `scripts/`, or by
any workflow. It is reproduction evidence, not part of the site or its checks.
As defence in depth, no file in it is named `*.test.mjs`; the root test glob
is `scripts/**/*.test.mjs` and cannot reach `docs/` anyway, so the naming rule
is a second line, not the mechanism. A repo-root `.gitignore` ignores
`node_modules/` so an install cannot be committed.

## Context
ADR-005 published a three-tier evidence standard — A primary dated, B primary
undated, C observed — and the benchmark then went a year without ever using
tier C. Every cell was read off vendor documentation. Vercel AI SDK was the
first tool where the documentation genuinely did not settle a criterion:
`multi-agent-parallel` is described there as a caller-written `Promise.all`
pattern rather than a feature, so the only way to answer it was to run the
thing and record what happened.

That raised five questions ADR-005 never had to answer, because none of them
exists until tier C does. Where does the artefact live? What does `source`
hold when the evidence is not a URL? Is the tier machine-readable? What
exactly was scored, when "the AI SDK" can mean a package, a gateway and a
hosting platform? And what does a site visitor see, given that a `/100` and a
feature chip look identical whether they rest on a vendor doc or on a local
script run?

The last question is the one that made this an ADR rather than a line in a
plan. Tier-C evidence is weaker in one specific way — a mock model proves a
mechanism exists, not that a real model drives it well — and stronger in
another: it is reproducible by anyone, which no vendor doc is. Publishing it
without saying which cells it holds up would make the matrix less honest than
it was before, not more.

Two alternatives were rejected. **Adding a `tier` field to matrix cells**
would make the evidence machine-readable, and ADR-005 explicitly defers that
as follow-on work; doing it here would have meant extending the verifier
inside a tool-addition feature. **Merging `docs/evaluations/` and
`docs/hands-on/` into one per-tool tree** is a plausible later simplification
and is still open; it was not worth doing on a sample of one.

## Consequences
Tier-C evidence is now discoverable in two places and only two: the evaluation
record names the tier, and the published page names the cells. It is not
discoverable from `data/tools.json`, where a tier-C cell looks like any other
sourced cell except that its `source` is a path rather than a URL. A reader
auditing the JSON alone cannot tell the tiers apart. That is the accepted cost
of D2, and it is the thing to revisit first if tier C stops being rare.

`docs/hands-on/` is the first `node_modules` this repository can produce. It
adds nothing to the root install, to CI or to the site, and CLAUDE.md rule 4
("no build-step creep") holds for everything that ships — but the repository
is no longer dependency-free in the literal sense, and that is a real change
worth noticing rather than discovering later.

The D6 disclosures are prose. No test asserts that they exist, that they are
accurate, or that they still match the version they describe. Only a reviewer
reading the page catches a stale one. Adding a parser for them would be the
build-step creep the project refuses, so the trade is deliberate: the
transparency is real, the enforcement is human.

Naming the scored artefact (D1) will produce scores that look low to a reader
thinking of a whole vendor stack. That is the intended reading, and the page
note is what makes it legible. The alternative — quietly widening the scope
when a criterion is awkward — is the failure ADR-002 exists to prevent.
