# ADR-006: Visitor reweighting is a view, the published rubric is the rating

Date: 2026-08-21
Status: accepted

## Decision
A visitor may reweight the six rubric dimensions and see the tools re-ranked
under their own weights. That is a **view**. The rating is the published rubric
of ADR-005, and it is the only thing the site asserts. Seven rules keep the two
apart:

1. **The published grid never moves.** It does not re-order, re-render or
   change a digit when a slider moves. The weighting panel is a separate
   section below it and writes only into its own containers.
2. **Every adjusted figure is labelled as the visitor's own**, in both
   languages: the section title says so, a persistent note repeats it, and the
   two ranking columns are headed "Ihre Gewichtung" / "Your weighting" and
   "Veröffentlicht" / "Published" side by side, so the published number stays
   next to the adjusted one.
3. **The weighting lives in `localStorage` only.** No URL parameter, no `?w=`
   encoding, no shareable link, no export. The site therefore never transmits
   or encodes a reweighted number, and a reweighted ranking cannot be handed to
   a third party wearing the site's authority.
4. **Two presets, both published and reproducible**: the published weights, and
   equal weights. Neither is a named verdict — no "ops-focused" or
   "enterprise" preset. A preset name is an editorial claim about which
   dimensions matter, which CLAUDE.md rule 3 does not permit us to make for
   free. The free sliders reach every such vector anyway.
5. **Only the six rubric dimensions are weightable.** Badges, descriptors, the
   Verdict section, the Methodology table, the pricing section and the feature
   matrix are inert to visitor weights.
6. **The published weights exist once per page**, in the Methodology table. The
   panel reads them from there; it keeps no copy. The score cards publish
   `raw`, `max` and the rounded points, and no weight.
7. **An unrated tool stays unrated at every weighting, including maturity
   weight 0.** It is listed apart, with the reason read from its own card, and
   never with a total or a zero.

Rule 7 is the one worth stating twice. ADR-005's amendment makes missing
tier-A evidence a *finding*, not a zero: scoring absent evidence as 0 would
publish "immature" on the strength of nothing. Redistributing the missing
weight would be worse — it would measure that tool on a different denominator
from every other tool, and the evidence does not appear because the visitor
stopped caring about it. So the weighting cannot promote a tool out of being
unrated, and the engine's formula returns no total for it whatever the weights
say.

## Context
The rubric published under ADR-005 is a weighted sum, and the weights are a
judgment: 25 for orchestration and 10 for accessibility is defensible, not
derivable. The honest response to "your weights are wrong for me" is to show
the decomposition and let the reader reweight it — the ranking is then visibly
a function of stated inputs rather than an oracle.

The risk is the mirror image: a site whose headline ranking changes under the
reader's hand has no rating at all, only a configurator, and a screenshot of a
tuned ranking carries the site's credibility into an argument the site never
made. That is why this is a view and not a mode: the published grid, the
badges and the verdict stay exactly where they were, and the panel is
subordinate to them in position, labelling and persistence.

Two options were rejected. **Fetching `data/tools.json` at runtime** to build
the panel would have avoided a second copy of the dimension figures, but
ADR-001 makes `tools.json` an assertion *about* the served pages, not a runtime
input; making the page fetch it turns the assertion into a dependency and
removes the thing `verify` proves. It also fails under `file://`. **Encoding
the weighting in the URL** would make a reweighted ranking shareable, which is
precisely rule 3's failure mode.

## Consequences

**(a) Reserved class names between the score grid and the matrix.** Anything
placed between `<div class="score-grid">` and `<!-- Feature Matrix -->` lands
inside the slice `parseScores` reads, and because that parser chunks on
`<div class="score-card`, everything after the last card is appended to the
last card's chunk — today `manus-ai`, the unrated one. Markup in that range
must therefore not contain `score-number`, `score-bar-fill`,
`score-descriptor`, `<div class="score-card` or `<div class="dim`. The
weighting panel prefixes every class and id it introduces with `wt-` for this
reason, and `scripts/panel.test.mjs` enforces the rule with occurrence counts
over the whole slice — not a negative match over the panel alone, which would
miss anything dropped elsewhere in the range. This ADR is the rule's durable
home; `PLAN.md` is transient.

**(b) The storage contract.** Key `aiab.dimension-weights.v1`, value
`{"v":1,"w":{<dimension>:<integer 0-50>}}`. It is read on load and written on
`change` (not on `input`, or a drag would fire a hundred synchronous writes a
second). A stored value that is missing, unparseable, of another version,
missing a dimension or out of range is ignored silently and the published
weights are used — it is **not** deleted, because a future schema's data is not
this page's to destroy. Reset applies the published weights and removes the
key. No consent artifact is required for it, and the reasoning matters more
than the conclusion: this is a functional store holding the visitor's own
slider positions, written only as a result of their own action on the page and
never transmitted anywhere, which is the case ePrivacy Art. 5(3) exempts as
"strictly necessary in order to provide a service explicitly requested by the
subscriber or user". The claim is scoped to the weighting alone and says
nothing about what else the page as a whole loads. DE and EN share the key:
they are the same origin, and a visitor's weighting is not language-specific.

**(c) What the 144 new figure checks do and do not prove.** `verify` now checks
every published dimension figure on both pages against `data/tools.json`:
`data-raw`, `data-max`, the `raw/max` label, the rounded points, the label and
its title against the Methodology row, and the full-precision total against
`score.exact` and `score.value`. That proves **the pages match `tools.json`**.
It does **not** prove that a rubric `raw` value follows the matrix cells
ADR-005 names as its input — nothing checks that link, and these checks must
not be read as if they did.

**(d) Two precisions, deliberately.** The figures on the cards are rounded
half-up to two decimals so they fit a card (`3.33` where the exact value is
`3.3333`); the method note says they are rounded and the exact inputs sit
beside them. Both pages write the figure the same way, with a dot — the German
page too, against German convention — so that the two files carry
byte-identical figure strings and `verify` can compare them directly instead of
parsing each page in its own locale. The panel's own readouts follow the same
convention. Every check and the weighting engine run on full precision, with
a single half-up rounding on the total only. The displayed rounding is
therefore never an input to anything, and the displayed figures are not claimed
to sum to `score.exact`.

**(e) Nothing here regenerates data.** `scripts/extract.mjs` remains a one-time
bootstrap that destroys sources when re-run; it can no more regenerate the
rubric and the dimension markup than it could the sources, so `npm run extract`
is still not a round trip. And the panel does not change what is published: a
weight change is an amendment to ADR-005, argued and re-derived across all
twelve tools, not something the UI can do.

**(f) The formula exists in three places and is proven identical.** The pages
cannot import a module (no build step, and `file://` forbids it), so the
arithmetic lives inside both pages' engines and in `scripts/lib/rubric.mjs`.
The `wt-formula` block is byte-compared across all three, and the two engines
are byte-compared outside their string tables. What remains untested by
machine is everything *around* the formula — the DOM reads, the rendering, the
persistence — because a browser harness would be a dependency and a build step.
Those are verified by hand, in both languages, per the checklist in the plan.
