# Benchmark Data Verification (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DE/EN benchmark data consistency and source coverage mechanically checkable, without changing what the site serves.

**Architecture:** `data/tools.json` becomes an assertion about what `index.html` and `index.en.html` must contain — not a template input. A shared zero-dependency parser reads both HTML files; `scripts/extract.mjs` uses it once to bootstrap the JSON baseline, and `scripts/verify.mjs` uses it on every run to prove HTML, JSON, and the two languages still agree. The HTML remains the served artifact and is still edited directly.

**Tech Stack:** Node 22 (v22.22.2 confirmed present), ES modules (`.mjs`), built-in `node:test` runner, built-in `node:assert/strict`. Zero npm dependencies.

## Global Constraints

- **Zero runtime and dev dependencies.** No npm packages, no DOM parser. String/regex extraction only. (`CLAUDE.md` rule 4: every dependency needs a reason.)
- **No build step.** Nothing in this plan generates HTML. The served files stay hand-edited.
- **No visual change.** The only markup edits are added attributes. `git diff` must show zero changes to text content, CSS, or JS.
- **Tool keys are the existing `data-tool` slugs**, exactly: `maestro`, `langgraph`, `google-adk`, `strands`, `databricks`, `crewai`, `n8n`, `ms-agent`, `claude-sdk`, `claude-squad`, `openai-sdk`, `manus-ai`.
- **Never key by column index.** Matrix column order differs from score-grid order (`ms-agent`/`n8n` and `openai-sdk`/`claude-squad` are swapped). Always resolve via `data-tool`.
- **Expected counts, asserted by the parser:** 12 tools, 14 features, 168 matrix chips, 12 price cards, 42 price rows total (per-card counts vary from 2 to 5).
- **Files live at repo root**: `index.html` (DE), `index.en.html` (EN). `index.html.bak` is not a served file and must never be read or written by these scripts.
- **Authoritative config dir is root `.claude/`.** `agentic-workflow/` is a stale duplicate; do not add files there.
- **Commits:** conventional commits. `data:` commits touch scoring data and must reference a source in the body.

## File Structure

| File | Responsibility |
|---|---|
| `scripts/lib/parse-html.mjs` | Pure functions: HTML string → structured data. No I/O, no assertions about correctness, only about structural completeness. |
| `scripts/lib/parse-html.test.mjs` | Unit tests against small inline fixtures + integration tests against the real files. |
| `scripts/extract.mjs` | One-time bootstrap. Reads both HTML files, writes `data/tools.json`. |
| `scripts/verify.mjs` | The checker. Compares JSON ⟷ DE ⟷ EN, reports source coverage, blocks unsourced changes. |
| `scripts/verify.test.mjs` | Tests that verify.mjs actually fails on injected drift. |
| `data/tools.json` | The assertion baseline. |
| `package.json` | Script aliases only. No dependencies. |

---

### Task 1: Add markup affordances

Price cards are currently identified only by their display text; matrix rows only by feature name. Both need stable keys before anything can parse them reliably. Attribute-only edits — no visual change.

**Files:**
- Modify: `index.html` (12 price-card openings, 14 matrix row first-cells)
- Modify: `index.en.html` (same 26 locations)

**Interfaces:**
- Consumes: nothing.
- Produces: `<div class="price-card" data-tool="KEY">` and `<div class="price-card is-featured" data-tool="KEY">` openings; `<td data-feature="KEY">` on each matrix row's first cell.

Price cards appear in this order in **both** files (already verified identical):
`maestro`, `langgraph`, `google-adk`, `strands`, `databricks`, `crewai`, `n8n`, `ms-agent`, `claude-sdk`, `claude-squad`, `manus-ai`, `openai-sdk`

Note this differs from both the score-grid and matrix orders. Do not assume.

Matrix rows in order, with the feature keys to assign:

| # | Feature name (DE) | `data-feature` key |
|---|---|---|
| 1 | Multi-Agent Parallel | `multi-agent-parallel` |
| 2 | Desktop GUI | `desktop-gui` |
| 3 | Playbooks / Auto-Run | `playbooks` |
| 4 | Mobile Remote Control | `mobile-remote` |
| 5 | Git Worktrees | `git-worktrees` |
| 6 | Agent Group Chat | `group-chat` |
| 7 | MCP-Support | `mcp-support` |
| 8 | Open Source | `open-source` |
| 9 | CLI / CI/CD | `cli-cicd` |
| 10 | Observability | `observability` |
| 11 | Human-in-the-Loop | `hitl` |
| 12 | EU / On-Prem Hosting | `eu-onprem` |
| 13 | Model-Agnostisch | `model-agnostic` |
| 14 | Lernkurve | `learning-curve` |

- [ ] **Step 1: Add `data-tool` to the 12 price cards in `index.html`**

Only the card openings change. `price-card-header` and `price-card-body` must stay untouched.

Before: `      <div class="price-card is-featured">`
After:  `      <div class="price-card is-featured" data-tool="maestro">`

Before: `      <div class="price-card">`
After:  `      <div class="price-card" data-tool="langgraph">`

…and so on down the order listed above.

- [ ] **Step 2: Verify the DE price-card edit**

```bash
grep -c '<div class="price-card[^"]*" data-tool="' index.html
```
Expected: `12`

```bash
grep -o '<div class="price-card[^"]*" data-tool="[^"]*"' index.html | grep -o 'data-tool="[^"]*"'
```
Expected, in order: maestro, langgraph, google-adk, strands, databricks, crewai, n8n, ms-agent, claude-sdk, claude-squad, manus-ai, openai-sdk

- [ ] **Step 3: Repeat Steps 1–2 for `index.en.html`**

Same 12 cards, same order, same keys.

- [ ] **Step 4: Add `data-feature` to the 14 matrix rows in `index.html`**

Before: `            <td><span class="feature-name">MCP-Support</span><span class="feature-desc">…</span></td>`
After:  `            <td data-feature="mcp-support"><span class="feature-name">MCP-Support</span><span class="feature-desc">…</span></td>`

Only the first `<td>` of each row. The 12 chip cells that follow are untouched.

- [ ] **Step 5: Repeat Step 4 for `index.en.html`**

English feature names differ; the keys do not. Assign keys by row position using the table above — row 7 is `mcp-support` in both files regardless of its English label.

- [ ] **Step 6: Verify no content changed**

```bash
git diff --stat
git diff -U0 index.html index.en.html | grep '^[-+]' | grep -v '^[-+][-+]' | wc -l
```
Expected: 104 changed lines (26 locations × 2 files × before+after).

```bash
git diff -U0 | grep '^-' | grep -v '^--' | sed 's/ data-tool="[^"]*"//; s/ data-feature="[^"]*"//' > /tmp/before.txt
git diff -U0 | grep '^+' | grep -v '^++' | sed 's/ data-tool="[^"]*"//; s/ data-feature="[^"]*"//' | sed 's/^+/-/' > /tmp/after.txt
diff /tmp/before.txt /tmp/after.txt && echo "ATTRIBUTE-ONLY: confirmed"
```
Expected: `ATTRIBUTE-ONLY: confirmed` — stripping the new attributes makes the diff vanish, proving nothing else moved.

- [ ] **Step 7: Verify counts still hold**

```bash
for f in index.html index.en.html; do
  echo "$f: $(grep -c '<span class="chip ' $f) chips, $(grep -c 'data-feature=' $f) features, $(grep -c 'class="price-card[^"]*" data-tool=' $f) price cards"
done
```
Expected for both: `168 chips, 14 features, 12 price cards`

- [ ] **Step 8: Commit**

```bash
git add index.html index.en.html
git commit -m "feat: add data-tool and data-feature keys to price cards and matrix rows

Attribute-only change, no visual or content difference. Gives the
verification scripts stable keys so matrix cells and price cards are
addressed by tool rather than by column position."
```

---

### Task 2: Parser — score cards

**Files:**
- Create: `scripts/lib/parse-html.mjs`
- Create: `scripts/lib/parse-html.test.mjs`
- Create: `package.json`

**Interfaces:**
- Consumes: markup from Task 1.
- Produces: `sliceBetween(html, startMarker, endMarker) -> string`, `parseScores(html) -> Map<toolKey, {score:number, barWidth:number, descriptor:string}>`. Later tasks call both.

- [ ] **Step 1: Create `package.json`**

Script aliases only — no dependencies, no build.

```json
{
  "name": "ai-agent-orchestration-benchmark",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test scripts/",
    "verify": "node scripts/verify.mjs",
    "extract": "node scripts/extract.mjs"
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `scripts/lib/parse-html.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sliceBetween, parseScores } from './parse-html.mjs';

const SCORES_FIXTURE = `
  <div class="score-grid">
      <div class="score-card" data-tool="alpha">
        <div class="score-tool"><a href="https://a.example">Alpha</a></div>
        <div class="score-number">84</div>
        <div class="score-bar-track"><div class="score-bar-fill" style="width:84%"></div></div>
        <div class="score-descriptor">Desktop Orchestrator</div>
      </div>
      <div class="score-card is-top" data-tool="beta">
        <div class="score-tool"><a href="https://b.example">Beta</a> <span class="score-badge badge-top">Best Overall</span></div>
        <div class="score-number">89</div>
        <div class="score-bar-track"><div class="score-bar-fill" style="width:89%"></div></div>
        <div class="score-descriptor">Code-First Framework</div>
      </div>
  </div>
  <!-- Feature Matrix -->
`;

test('sliceBetween returns the span between markers', () => {
  assert.equal(sliceBetween('aaXbbYcc', 'X', 'Y'), 'Xbb');
});

test('sliceBetween throws when the start marker is missing', () => {
  assert.throws(() => sliceBetween('abc', 'ZZZ', 'Y'), /marker not found: ZZZ/);
});

test('parseScores reads every card keyed by data-tool', () => {
  const scores = parseScores(SCORES_FIXTURE);
  assert.equal(scores.size, 2);
  assert.deepEqual(scores.get('alpha'), {
    score: 84, barWidth: 84, descriptor: 'Desktop Orchestrator',
  });
  assert.deepEqual(scores.get('beta'), {
    score: 89, barWidth: 89, descriptor: 'Code-First Framework',
  });
});

test('parseScores keeps the score-card modifier class out of the key', () => {
  const scores = parseScores(SCORES_FIXTURE);
  assert.ok(scores.has('beta'), 'is-top card must still key as beta');
});

test('parseScores throws when a card is missing its score number', () => {
  const broken = SCORES_FIXTURE.replace('<div class="score-number">84</div>', '');
  assert.throws(() => parseScores(broken), /alpha/);
});
```

- [ ] **Step 3: Run the test and confirm it fails**

```bash
node --test scripts/
```
Expected: FAIL — `Cannot find module .../parse-html.mjs`

- [ ] **Step 4: Implement**

Create `scripts/lib/parse-html.mjs`:

```js
/**
 * Zero-dependency extraction of benchmark data from the served HTML.
 * These functions describe what the HTML *says*. They make no claim about
 * whether it is correct — that is verify.mjs's job.
 */

export function sliceBetween(html, startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  if (start === -1) throw new Error(`marker not found: ${startMarker}`);
  const end = html.indexOf(endMarker, start + startMarker.length);
  if (end === -1) throw new Error(`end marker not found after: ${startMarker}`);
  return html.slice(start, end);
}

export function parseScores(html) {
  const block = sliceBetween(html, '<div class="score-grid">', '<!-- Feature Matrix -->');
  const chunks = block.split('<div class="score-card').slice(1);
  const scores = new Map();

  for (const chunk of chunks) {
    const key = /^[^>]*data-tool="([^"]+)"/.exec(chunk)?.[1];
    if (!key) throw new Error('score card without data-tool attribute');

    const score = /<div class="score-number">(\d+)<\/div>/.exec(chunk)?.[1];
    const barWidth = /score-bar-fill" style="width:(\d+)%/.exec(chunk)?.[1];
    const descriptor = /<div class="score-descriptor">([\s\S]*?)<\/div>/.exec(chunk)?.[1];

    if (score === undefined) throw new Error(`score card ${key}: no score-number`);
    if (barWidth === undefined) throw new Error(`score card ${key}: no score-bar-fill width`);
    if (descriptor === undefined) throw new Error(`score card ${key}: no score-descriptor`);

    scores.set(key, {
      score: Number(score),
      barWidth: Number(barWidth),
      descriptor: descriptor.trim(),
    });
  }

  return scores;
}
```

- [ ] **Step 5: Run the test and confirm it passes**

```bash
node --test scripts/
```
Expected: PASS, 5 tests.

- [ ] **Step 6: Add an integration test against the real files**

Append to `scripts/lib/parse-html.test.mjs`:

```js
import { readFileSync } from 'node:fs';

const DE = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const EN = readFileSync(new URL('../../index.en.html', import.meta.url), 'utf8');

const TOOL_KEYS = [
  'maestro', 'langgraph', 'google-adk', 'strands', 'databricks', 'crewai',
  'n8n', 'ms-agent', 'claude-sdk', 'claude-squad', 'openai-sdk', 'manus-ai',
];

test('parseScores finds all 12 tools in both real files', () => {
  for (const [name, html] of [['de', DE], ['en', EN]]) {
    const scores = parseScores(html);
    assert.equal(scores.size, 12, `${name}: expected 12 score cards`);
    for (const key of TOOL_KEYS) {
      assert.ok(scores.has(key), `${name}: missing tool ${key}`);
    }
  }
});

test('every score bar width matches its score in both real files', () => {
  for (const [name, html] of [['de', DE], ['en', EN]]) {
    for (const [key, { score, barWidth }] of parseScores(html)) {
      assert.equal(barWidth, score, `${name}/${key}: bar ${barWidth}% vs score ${score}`);
    }
  }
});
```

- [ ] **Step 7: Run and confirm it passes**

```bash
node --test scripts/
```
Expected: PASS, 7 tests. If the bar-width test fails, stop — that is real data drift and must be reported, not patched.

- [ ] **Step 8: Commit**

```bash
git add package.json scripts/lib/parse-html.mjs scripts/lib/parse-html.test.mjs
git commit -m "feat: add zero-dependency HTML parser for score cards"
```

---

### Task 3: Parser — feature matrix

**Files:**
- Modify: `scripts/lib/parse-html.mjs`
- Modify: `scripts/lib/parse-html.test.mjs`

**Interfaces:**
- Consumes: `sliceBetween` from Task 2.
- Produces: `parseMatrix(html) -> {toolOrder: string[], features: Array<{key, label, desc}>, cells: Map<toolKey, Map<featureKey, {state, label}>>}` where `state` is `'yes' | 'partial' | 'no'`.

- [ ] **Step 1: Write the failing test**

Append to `scripts/lib/parse-html.test.mjs`:

```js
import { parseMatrix } from './parse-html.mjs';

const MATRIX_FIXTURE = `
  <!-- Feature Matrix -->
      <table>
        <thead>
          <tr>
            <th class="feature-col">Feature</th>
            <th data-tool="alpha">Alpha</th>
            <th data-tool="beta">Beta</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-feature="mcp-support"><span class="feature-name">MCP-Support</span><span class="feature-desc">Protokoll</span></td>
            <td><span class="chip chip-yes">Vollst&auml;ndig</span></td>
            <td><span class="chip chip-partial">Begrenzt</span></td>
          </tr>
          <tr>
            <td data-feature="desktop-gui"><span class="feature-name">Desktop GUI</span><span class="feature-desc">Native App</span></td>
            <td><span class="chip chip-no">Nein</span></td>
            <td><span class="chip chip-yes">Vollst&auml;ndig</span></td>
          </tr>
        </tbody>
      </table>
  <!-- Pricing -->
`;

test('parseMatrix reads column order from the header', () => {
  assert.deepEqual(parseMatrix(MATRIX_FIXTURE).toolOrder, ['alpha', 'beta']);
});

test('parseMatrix reads feature keys, labels and descriptions', () => {
  assert.deepEqual(parseMatrix(MATRIX_FIXTURE).features, [
    { key: 'mcp-support', label: 'MCP-Support', desc: 'Protokoll' },
    { key: 'desktop-gui', label: 'Desktop GUI', desc: 'Native App' },
  ]);
});

test('parseMatrix attributes each cell to its tool by header position', () => {
  const { cells } = parseMatrix(MATRIX_FIXTURE);
  assert.deepEqual(cells.get('alpha').get('mcp-support'), { state: 'yes', label: 'Vollst&auml;ndig' });
  assert.deepEqual(cells.get('beta').get('mcp-support'), { state: 'partial', label: 'Begrenzt' });
  assert.deepEqual(cells.get('alpha').get('desktop-gui'), { state: 'no', label: 'Nein' });
  assert.deepEqual(cells.get('beta').get('desktop-gui'), { state: 'yes', label: 'Vollst&auml;ndig' });
});

test('parseMatrix throws when a row has the wrong number of chips', () => {
  const broken = MATRIX_FIXTURE.replace('<td><span class="chip chip-partial">Begrenzt</span></td>', '');
  assert.throws(() => parseMatrix(broken), /mcp-support.*1 chips.*2 tools/s);
});

test('parseMatrix throws when a row has no data-feature key', () => {
  const broken = MATRIX_FIXTURE.replace(' data-feature="desktop-gui"', '');
  assert.throws(() => parseMatrix(broken), /data-feature/);
});
```

- [ ] **Step 2: Run and confirm it fails**

```bash
node --test scripts/
```
Expected: FAIL — `parseMatrix is not exported`

- [ ] **Step 3: Implement**

Append to `scripts/lib/parse-html.mjs`:

```js
export function parseMatrix(html) {
  const block = sliceBetween(html, '<!-- Feature Matrix -->', '<!-- Pricing -->');

  const toolOrder = [...block.matchAll(/<th data-tool="([^"]+)">/g)].map((m) => m[1]);
  if (toolOrder.length === 0) throw new Error('matrix: no <th data-tool> headers found');

  const body = sliceBetween(block, '<tbody>', '</tbody>');
  const rows = body.split('<tr>').slice(1);

  const features = [];
  const cells = new Map(toolOrder.map((key) => [key, new Map()]));

  for (const row of rows) {
    const key = /<td data-feature="([^"]+)"/.exec(row)?.[1];
    if (!key) throw new Error('matrix row without a data-feature key');

    const label = /<span class="feature-name">([\s\S]*?)<\/span>/.exec(row)?.[1];
    const desc = /<span class="feature-desc">([\s\S]*?)<\/span>/.exec(row)?.[1];
    if (label === undefined) throw new Error(`matrix row ${key}: no feature-name`);
    if (desc === undefined) throw new Error(`matrix row ${key}: no feature-desc`);

    const chips = [...row.matchAll(/<span class="chip chip-(yes|partial|no)">([\s\S]*?)<\/span>/g)]
      .map((m) => ({ state: m[1], label: m[2].trim() }));

    if (chips.length !== toolOrder.length) {
      throw new Error(
        `matrix row ${key}: ${chips.length} chips but ${toolOrder.length} tools`,
      );
    }

    features.push({ key, label: label.trim(), desc: desc.trim() });
    toolOrder.forEach((toolKey, i) => cells.get(toolKey).set(key, chips[i]));
  }

  return { toolOrder, features, cells };
}
```

- [ ] **Step 4: Run and confirm it passes**

```bash
node --test scripts/
```
Expected: PASS, 12 tests.

- [ ] **Step 5: Add the real-file integration test**

Append to `scripts/lib/parse-html.test.mjs`:

```js
test('parseMatrix finds 12 tools x 14 features in both real files', () => {
  for (const [name, html] of [['de', DE], ['en', EN]]) {
    const { toolOrder, features, cells } = parseMatrix(html);
    assert.equal(toolOrder.length, 12, `${name}: expected 12 matrix columns`);
    assert.equal(features.length, 14, `${name}: expected 14 matrix rows`);
    const total = [...cells.values()].reduce((n, m) => n + m.size, 0);
    assert.equal(total, 168, `${name}: expected 168 cells`);
  }
});

test('matrix column order really does differ from score-grid order', () => {
  // Guards the constraint that makes positional indexing unsafe.
  const scoreOrder = [...parseScores(DE).keys()];
  const { toolOrder } = parseMatrix(DE);
  assert.notDeepEqual(scoreOrder, toolOrder);
  assert.deepEqual([...scoreOrder].sort(), [...toolOrder].sort());
});

test('both files agree on matrix feature keys and their order', () => {
  assert.deepEqual(
    parseMatrix(DE).features.map((f) => f.key),
    parseMatrix(EN).features.map((f) => f.key),
  );
});
```

- [ ] **Step 6: Run and confirm it passes**

```bash
node --test scripts/
```
Expected: PASS, 15 tests.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/parse-html.mjs scripts/lib/parse-html.test.mjs
git commit -m "feat: parse feature matrix, keyed by tool rather than column index"
```

---

### Task 4: Parser — price cards and page meta

**Files:**
- Modify: `scripts/lib/parse-html.mjs`
- Modify: `scripts/lib/parse-html.test.mjs`

**Interfaces:**
- Consumes: `sliceBetween` from Task 2.
- Produces:
  - `parsePrices(html) -> Map<toolKey, {name, type, main, note, rows: Array<{label, value, tone}>}>` where `tone` is `'default' | 'free' | 'muted'`.
  - `parseMeta(html) -> {asOf: string, newsDates: string[]}`.

- [ ] **Step 1: Write the failing test**

Append to `scripts/lib/parse-html.test.mjs`:

```js
import { parsePrices, parseMeta } from './parse-html.mjs';

const PRICES_FIXTURE = `
  <!-- Pricing -->
    <div class="price-grid">
      <div class="price-card is-featured" data-tool="alpha">
        <div class="price-card-header">
          <div class="price-tool">Alpha</div>
          <div class="price-type">Desktop Agent Orchestrator</div>
        </div>
        <div class="price-card-body">
          <div class="price-main">Kostenlos</div>
          <div class="price-note">Open Source &middot; AGPL-3.0</div>
          <div class="price-rows">
            <div class="price-row"><span class="price-row-label">Self-hosted</span><span class="price-row-value is-free">&euro;0</span></div>
            <div class="price-row"><span class="price-row-label">Cloud</span><span class="price-row-value is-muted">TBD</span></div>
          </div>
        </div>
      </div>
      <div class="price-card" data-tool="beta">
        <div class="price-card-header">
          <div class="price-tool">Beta</div>
          <div class="price-type">Framework</div>
        </div>
        <div class="price-card-body">
          <div class="price-main">&euro;0</div>
          <div class="price-note">Open Source (MIT)</div>
          <div class="price-rows">
            <div class="price-row"><span class="price-row-label">Plus</span><span class="price-row-value">~&euro;39/Mo.</span></div>
          </div>
        </div>
      </div>
    </div>
  <!-- Verdict -->
`;

test('parsePrices keys cards by data-tool, including the featured card', () => {
  const prices = parsePrices(PRICES_FIXTURE);
  assert.deepEqual([...prices.keys()], ['alpha', 'beta']);
});

test('parsePrices reads header, main figure and note', () => {
  const alpha = parsePrices(PRICES_FIXTURE).get('alpha');
  assert.equal(alpha.name, 'Alpha');
  assert.equal(alpha.type, 'Desktop Agent Orchestrator');
  assert.equal(alpha.main, 'Kostenlos');
  assert.equal(alpha.note, 'Open Source &middot; AGPL-3.0');
});

test('parsePrices reads variable-length rows with their tone', () => {
  const prices = parsePrices(PRICES_FIXTURE);
  assert.deepEqual(prices.get('alpha').rows, [
    { label: 'Self-hosted', value: '&euro;0', tone: 'free' },
    { label: 'Cloud', value: 'TBD', tone: 'muted' },
  ]);
  assert.deepEqual(prices.get('beta').rows, [
    { label: 'Plus', value: '~&euro;39/Mo.', tone: 'default' },
  ]);
});

test('parsePrices ignores price-card-header and price-card-body', () => {
  assert.equal(parsePrices(PRICES_FIXTURE).size, 2);
});

test('parseMeta reads the German stamp and news dates', () => {
  const html = `<span class="topbar-meta">Stand: Juli 2026</span>
    <span class="news-date">Juli 2026</span><span class="news-date">26. Mai 2026</span>`;
  assert.deepEqual(parseMeta(html), {
    asOf: 'Juli 2026',
    newsDates: ['Juli 2026', '26. Mai 2026'],
  });
});

test('parseMeta reads the English stamp', () => {
  const html = `<span class="topbar-meta">As of: July 2026</span>
    <span class="news-date">July 2026</span>`;
  assert.equal(parseMeta(html).asOf, 'July 2026');
});
```

- [ ] **Step 2: Run and confirm it fails**

```bash
node --test scripts/
```
Expected: FAIL — `parsePrices is not exported`

- [ ] **Step 3: Implement**

Append to `scripts/lib/parse-html.mjs`:

```js
const PRICE_CARD_RE = /<div class="price-card(?: is-featured)?" data-tool="([^"]+)">/g;

export function parsePrices(html) {
  const block = sliceBetween(html, '<!-- Pricing -->', '<!-- Verdict -->');
  const starts = [...block.matchAll(PRICE_CARD_RE)];
  if (starts.length === 0) throw new Error('pricing: no price cards with data-tool found');

  const prices = new Map();

  starts.forEach((match, i) => {
    const key = match[1];
    const from = match.index;
    const to = i + 1 < starts.length ? starts[i + 1].index : block.length;
    const chunk = block.slice(from, to);

    const read = (cls) => {
      const value = new RegExp(`<div class="${cls}">([\\s\\S]*?)</div>`).exec(chunk)?.[1];
      if (value === undefined) throw new Error(`price card ${key}: no ${cls}`);
      return value.trim();
    };

    const rows = [...chunk.matchAll(
      /<span class="price-row-label">([\s\S]*?)<\/span><span class="price-row-value([^"]*)">([\s\S]*?)<\/span>/g,
    )].map((m) => ({
      label: m[1].trim(),
      value: m[3].trim(),
      tone: m[2].includes('is-free') ? 'free' : m[2].includes('is-muted') ? 'muted' : 'default',
    }));

    if (rows.length === 0) throw new Error(`price card ${key}: no price rows`);

    prices.set(key, {
      name: read('price-tool'),
      type: read('price-type'),
      main: read('price-main'),
      note: read('price-note'),
      rows,
    });
  });

  return prices;
}

export function parseMeta(html) {
  const asOf = /<span class="topbar-meta">(?:Stand|As of): ([^<]+)<\/span>/.exec(html)?.[1];
  if (asOf === undefined) throw new Error('meta: no topbar-meta stamp found');

  const newsDates = [...html.matchAll(/<span class="news-date">([^<]+)<\/span>/g)]
    .map((m) => m[1].trim());
  if (newsDates.length === 0) throw new Error('meta: no news-date entries found');

  return { asOf: asOf.trim(), newsDates };
}
```

- [ ] **Step 4: Run and confirm it passes**

```bash
node --test scripts/
```
Expected: PASS, 21 tests.

- [ ] **Step 5: Add the real-file integration test**

Append to `scripts/lib/parse-html.test.mjs`:

```js
test('parsePrices finds 12 cards and 42 rows in both real files', () => {
  for (const [name, html] of [['de', DE], ['en', EN]]) {
    const prices = parsePrices(html);
    assert.equal(prices.size, 12, `${name}: expected 12 price cards`);
    const rows = [...prices.values()].reduce((n, p) => n + p.rows.length, 0);
    assert.equal(rows, 42, `${name}: expected 42 price rows`);
  }
});

test('both files agree on price card order and per-card row counts', () => {
  const de = parsePrices(DE);
  const en = parsePrices(EN);
  assert.deepEqual([...de.keys()], [...en.keys()]);
  for (const [key, card] of de) {
    assert.equal(card.rows.length, en.get(key).rows.length, `${key}: row count differs`);
  }
});

test('the as-of stamp matches the newest changelog entry in both files', () => {
  assert.equal(parseMeta(DE).asOf, parseMeta(DE).newsDates[0]);
  assert.equal(parseMeta(EN).asOf, parseMeta(EN).newsDates[0]);
});
```

- [ ] **Step 6: Run and confirm it passes**

```bash
node --test scripts/
```
Expected: PASS, 24 tests.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/parse-html.mjs scripts/lib/parse-html.test.mjs
git commit -m "feat: parse price cards and page meta stamp"
```

---

### Task 5: Bootstrap `data/tools.json`

**Files:**
- Create: `scripts/extract.mjs`
- Create: `data/tools.json` (generated)

**Interfaces:**
- Consumes: `parseScores`, `parseMatrix`, `parsePrices`, `parseMeta`.
- Produces: `data/tools.json` in the shape the spec defines. `verify.mjs` (Task 6) reads it.

Every value is written with `"source": null, "provenance": "legacy-unsourced"`. Do not invent citations — the whole point of the provenance marker is that the gap stays visible.

- [ ] **Step 1: Write `scripts/extract.mjs`**

```js
/**
 * One-time bootstrap: snapshot the current HTML into data/tools.json.
 *
 * This is deliberately circular — the JSON is generated from the HTML it will
 * later be checked against. That makes the baseline accurate by construction.
 * It does NOT make the site's numbers true; sourcing does, and every value
 * starts life marked legacy-unsourced.
 *
 * Re-running this overwrites sources. It is a bootstrap, not a workflow step.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseScores, parseMatrix, parsePrices, parseMeta } from './lib/parse-html.mjs';

const root = new URL('..', import.meta.url);
const de = readFileSync(new URL('index.html', root), 'utf8');
const en = readFileSync(new URL('index.en.html', root), 'utf8');

const unsourced = { source: null, checked: null, provenance: 'legacy-unsourced' };

const deScores = parseScores(de);
const deMatrix = parseMatrix(de);
const enMatrix = parseMatrix(en);
const dePrices = parsePrices(de);
const enPrices = parsePrices(en);

const tools = {};
for (const [key, { score, descriptor }] of deScores) {
  const enScore = parseScores(en).get(key);
  if (!enScore) throw new Error(`${key}: present in DE score grid, missing from EN`);
  if (enScore.score !== score) {
    throw new Error(`${key}: DE score ${score} but EN score ${enScore.score} — fix before extracting`);
  }

  const matrix = {};
  for (const { key: featureKey } of deMatrix.features) {
    const deCell = deMatrix.cells.get(key).get(featureKey);
    const enCell = enMatrix.cells.get(key).get(featureKey);
    if (deCell.state !== enCell.state) {
      throw new Error(`${key}/${featureKey}: DE state ${deCell.state} but EN state ${enCell.state}`);
    }
    matrix[featureKey] = {
      state: deCell.state,
      label: { de: deCell.label, en: enCell.label },
      ...unsourced,
    };
  }

  const dePrice = dePrices.get(key);
  const enPrice = enPrices.get(key);
  tools[key] = {
    name: dePrice.name,
    score: { value: score, ...unsourced },
    descriptor: { de: descriptor, en: parseScores(en).get(key).descriptor },
    matrix,
    price: {
      type: { de: dePrice.type, en: enPrice.type },
      main: { de: dePrice.main, en: enPrice.main },
      note: { de: dePrice.note, en: enPrice.note },
      rows: dePrice.rows.map((row, i) => ({
        label: { de: row.label, en: enPrice.rows[i].label },
        value: { de: row.value, en: enPrice.rows[i].value },
        tone: row.tone,
        ...unsourced,
      })),
    },
  };
}

const data = {
  meta: {
    edition: '2026',
    asOf: { de: parseMeta(de).asOf, en: parseMeta(en).asOf },
    features: deMatrix.features.map((f, i) => ({
      key: f.key,
      label: { de: f.label, en: enMatrix.features[i].label },
      desc: { de: f.desc, en: enMatrix.features[i].desc },
    })),
    toolOrder: {
      scores: [...deScores.keys()],
      matrix: deMatrix.toolOrder,
      prices: [...dePrices.keys()],
    },
  },
  tools,
};

mkdirSync(new URL('data/', root), { recursive: true });
writeFileSync(new URL('data/tools.json', root), `${JSON.stringify(data, null, 2)}\n`);
console.log(`wrote data/tools.json — ${Object.keys(tools).length} tools, ` +
  `${deMatrix.features.length} features, all values marked legacy-unsourced`);
```

- [ ] **Step 2: Run the extractor**

```bash
node scripts/extract.mjs
```
Expected: `wrote data/tools.json — 12 tools, 14 features, all values marked legacy-unsourced`

If it throws a DE/EN mismatch instead, **stop and report it**. That is a real pre-existing data defect and needs its own decision, not a workaround.

- [ ] **Step 3: Sanity-check the output by hand**

```bash
node -e "
const d = require('./data/tools.json');
console.log('tools:', Object.keys(d.tools).length);
console.log('langgraph score:', d.tools.langgraph.score.value);
console.log('langgraph matrix keys:', Object.keys(d.tools.langgraph.matrix).length);
console.log('langgraph price rows:', d.tools.langgraph.price.rows.length);
console.log('asOf:', JSON.stringify(d.meta.asOf));
console.log('unsourced values:', JSON.stringify(d).split('\"legacy-unsourced\"').length - 1);
"
```
Expected: `tools: 12`, `langgraph score: 89`, `langgraph matrix keys: 14`, `langgraph price rows: 3`, `asOf: {"de":"Juli 2026","en":"July 2026"}`, `unsourced values: 222`

(222 = 12 scores + 168 matrix cells + 42 price rows.)

- [ ] **Step 4: Commit**

```bash
git add scripts/extract.mjs data/tools.json
git commit -m "data: bootstrap tools.json baseline from current site HTML

Snapshot of the values the site currently publishes: 12 tools, 14
feature-matrix rows, 42 price rows. Generated by scripts/extract.mjs
from index.html and index.en.html, so the baseline matches the served
pages by construction.

Source: index.html and index.en.html at this commit. Every value is
marked provenance=legacy-unsourced — the site carries no per-datapoint
citations today, and none were invented here. Sourcing is enforced on
future changes, not retroactively."
```

---

### Task 6: `verify.mjs` — structural and value checks

**Files:**
- Create: `scripts/verify.mjs`
- Create: `scripts/verify.test.mjs`

**Interfaces:**
- Consumes: the parser, `data/tools.json`.
- Produces: `collectFailures(de, en, data) -> string[]` (exported for testing) and a CLI that exits 1 when the array is non-empty.

- [ ] **Step 1: Write the failing test**

Create `scripts/verify.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectFailures } from './verify.mjs';

const root = new URL('../', import.meta.url);
const DE = readFileSync(new URL('index.html', root), 'utf8');
const EN = readFileSync(new URL('index.en.html', root), 'utf8');
const DATA = JSON.parse(readFileSync(new URL('data/tools.json', root), 'utf8'));

test('the unmodified site verifies clean', () => {
  assert.deepEqual(collectFailures(DE, EN, DATA), []);
});

test('a score changed in the DE file only is caught', () => {
  const broken = DE.replace(
    '<div class="score-number">89</div>',
    '<div class="score-number">91</div>',
  );
  const failures = collectFailures(broken, EN, DATA);
  assert.ok(failures.some((f) => f.includes('langgraph') && f.includes('89')),
    `expected a langgraph score failure, got: ${failures.join(' | ')}`);
});

test('a score bar desynced from its number is caught', () => {
  const broken = DE.replace('style="width:89%"', 'style="width:95%"');
  const failures = collectFailures(broken, EN, DATA);
  assert.ok(failures.some((f) => f.includes('bar')),
    `expected a bar-width failure, got: ${failures.join(' | ')}`);
});

test('a matrix chip state changed in the EN file only is caught', () => {
  const broken = EN.replace('<span class="chip chip-yes">', '<span class="chip chip-no">');
  const failures = collectFailures(DE, broken, DATA);
  assert.ok(failures.length > 0, 'expected at least one matrix failure');
});

test('an as-of stamp out of step with the changelog is caught', () => {
  const broken = DE.replace('Stand: Juli 2026', 'Stand: August 2026');
  const failures = collectFailures(broken, EN, DATA);
  assert.ok(failures.some((f) => f.toLowerCase().includes('as-of') || f.includes('asOf')),
    `expected an as-of failure, got: ${failures.join(' | ')}`);
});

test('a tool missing from pricing but present in the matrix is caught', () => {
  const data = structuredClone(DATA);
  delete data.tools.n8n;
  const failures = collectFailures(DE, EN, data);
  assert.ok(failures.some((f) => f.includes('n8n')),
    `expected an n8n coverage failure, got: ${failures.join(' | ')}`);
});
```

- [ ] **Step 2: Run and confirm it fails**

```bash
node --test scripts/
```
Expected: FAIL — `Cannot find module .../verify.mjs`

- [ ] **Step 3: Implement**

Create `scripts/verify.mjs`:

```js
/**
 * Proves data/tools.json, index.html and index.en.html all agree.
 *
 * Exits non-zero listing every mismatch. Reports source coverage but does not
 * fail on legacy-unsourced values — see docs/decisions for why.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseScores, parseMatrix, parsePrices, parseMeta } from './lib/parse-html.mjs';

export function collectFailures(deHtml, enHtml, data) {
  const failures = [];
  const fail = (msg) => failures.push(msg);

  const files = [['index.html', deHtml, 'de'], ['index.en.html', enHtml, 'en']];
  const expectedTools = Object.keys(data.tools);

  for (const [file, html, lang] of files) {
    let scores, matrix, prices, meta;
    try {
      scores = parseScores(html);
      matrix = parseMatrix(html);
      prices = parsePrices(html);
      meta = parseMeta(html);
    } catch (err) {
      fail(`${file}: parse error — ${err.message}`);
      continue;
    }

    // Tool coverage across all three sections.
    for (const section of [['score grid', scores], ['matrix', matrix.cells], ['pricing', prices]]) {
      const [label, map] = section;
      const found = [...map.keys()].sort();
      const expected = [...expectedTools].sort();
      if (found.join(',') !== expected.join(',')) {
        const missing = expected.filter((k) => !found.includes(k));
        const extra = found.filter((k) => !expected.includes(k));
        if (missing.length) fail(`${file} ${label}: missing tools ${missing.join(', ')}`);
        if (extra.length) fail(`${file} ${label}: unexpected tools ${extra.join(', ')}`);
      }
    }

    for (const key of expectedTools) {
      const tool = data.tools[key];

      const card = scores.get(key);
      if (card) {
        if (card.score !== tool.score.value) {
          fail(`${file} ${key}: score is ${card.score}, tools.json says ${tool.score.value}`);
        }
        if (card.barWidth !== card.score) {
          fail(`${file} ${key}: score bar is ${card.barWidth}% but score is ${card.score}`);
        }
        if (card.descriptor !== tool.descriptor[lang]) {
          fail(`${file} ${key}: descriptor "${card.descriptor}" != "${tool.descriptor[lang]}"`);
        }
      }

      const cells = matrix.cells.get(key);
      if (cells) {
        for (const [featureKey, expectedCell] of Object.entries(tool.matrix)) {
          const cell = cells.get(featureKey);
          if (!cell) {
            fail(`${file} ${key}/${featureKey}: matrix cell missing`);
            continue;
          }
          if (cell.state !== expectedCell.state) {
            fail(`${file} ${key}/${featureKey}: state ${cell.state}, tools.json says ${expectedCell.state}`);
          }
          if (cell.label !== expectedCell.label[lang]) {
            fail(`${file} ${key}/${featureKey}: label "${cell.label}" != "${expectedCell.label[lang]}"`);
          }
        }
      }

      const price = prices.get(key);
      if (price) {
        for (const field of ['type', 'main', 'note']) {
          if (price[field] !== tool.price[field][lang]) {
            fail(`${file} ${key}: price ${field} "${price[field]}" != "${tool.price[field][lang]}"`);
          }
        }
        if (price.rows.length !== tool.price.rows.length) {
          fail(`${file} ${key}: ${price.rows.length} price rows, tools.json says ${tool.price.rows.length}`);
        } else {
          price.rows.forEach((row, i) => {
            const expected = tool.price.rows[i];
            if (row.label !== expected.label[lang]) {
              fail(`${file} ${key} row ${i}: label "${row.label}" != "${expected.label[lang]}"`);
            }
            if (row.value !== expected.value[lang]) {
              fail(`${file} ${key} row ${i}: value "${row.value}" != "${expected.value[lang]}"`);
            }
            if (row.tone !== expected.tone) {
              fail(`${file} ${key} row ${i}: tone ${row.tone} != ${expected.tone}`);
            }
          });
        }
      }
    }

    if (meta.asOf !== data.meta.asOf[lang]) {
      fail(`${file}: as-of stamp "${meta.asOf}" != tools.json "${data.meta.asOf[lang]}"`);
    }
    if (meta.asOf !== meta.newsDates[0]) {
      fail(`${file}: as-of stamp "${meta.asOf}" != newest changelog entry "${meta.newsDates[0]}"`);
    }
  }

  return failures;
}

export function sourceCoverage(data) {
  let sourced = 0;
  let total = 0;
  const walk = (node) => {
    if (node && typeof node === 'object') {
      if ('provenance' in node || 'source' in node) {
        total += 1;
        if (node.source) sourced += 1;
      }
      for (const value of Object.values(node)) walk(value);
    }
  };
  walk(data.tools);
  return { sourced, total };
}

// Only run the CLI when invoked directly, never when imported by the tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../', import.meta.url);
  const de = readFileSync(new URL('index.html', root), 'utf8');
  const en = readFileSync(new URL('index.en.html', root), 'utf8');
  const data = JSON.parse(readFileSync(new URL('data/tools.json', root), 'utf8'));

  const failures = collectFailures(de, en, data);
  const { sourced, total } = sourceCoverage(data);

  if (failures.length === 0) {
    console.log(`OK — index.html, index.en.html and data/tools.json agree.`);
  } else {
    console.error(`FAIL — ${failures.length} mismatch(es):\n`);
    for (const f of failures) console.error(`  - ${f}`);
  }
  console.log(`\nsource coverage: ${sourced}/${total} data points cited ` +
    `(${total - sourced} still legacy-unsourced)`);

  process.exit(failures.length === 0 ? 0 : 1);
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
node --test scripts/
```
Expected: PASS, 30 tests.

- [ ] **Step 5: Run the verifier against the real site**

```bash
node scripts/verify.mjs; echo "exit=$?"
```
Expected:
```
OK — index.html, index.en.html and data/tools.json agree.

source coverage: 0/222 data points cited (222 still legacy-unsourced)
exit=0
```

This is spec verification criterion 1 — the baseline must be green before anything else is built on it.

- [ ] **Step 6: Manually confirm criteria 2 and 3 from the spec**

```bash
sed -i.tmp 's|<div class="score-number">89</div>|<div class="score-number">91</div>|' index.html
node scripts/verify.mjs; echo "exit=$? (expected 1)"
mv index.html.tmp index.html

sed -i.tmp '0,/<span class="chip chip-yes">/s//<span class="chip chip-no">/' index.en.html
node scripts/verify.mjs; echo "exit=$? (expected 1)"
mv index.en.html.tmp index.en.html

node scripts/verify.mjs; echo "exit=$? (expected 0, restored)"
git diff --quiet && echo "working tree clean: confirmed"
```

- [ ] **Step 7: Commit**

```bash
git add scripts/verify.mjs scripts/verify.test.mjs
git commit -m "feat: add verify.mjs proving HTML and tools.json agree

Checks scores, bar widths, matrix cell states and labels, price card
fields and rows, tool coverage across all three sections, and the
as-of stamp against the newest changelog entry — in both languages.
Green against the site as it stands."
```

---

### Task 7: `verify.mjs` — enforce sourcing on changes

**Files:**
- Modify: `scripts/verify.mjs`
- Modify: `scripts/verify.test.mjs`

**Interfaces:**
- Consumes: `data/tools.json`, git history.
- Produces: `changedWithoutSource(previous, current) -> string[]`, exported for testing and called by the CLI.

The rule: a value may be `legacy-unsourced` forever, but the moment it *changes* it must carry a real source and a `checked` date.

- [ ] **Step 1: Write the failing test**

Append to `scripts/verify.test.mjs`:

```js
import { changedWithoutSource } from './verify.mjs';

const base = {
  tools: {
    alpha: {
      score: { value: 80, source: null, checked: null, provenance: 'legacy-unsourced' },
      matrix: { 'mcp-support': { state: 'yes', label: { de: 'Ja', en: 'Yes' }, source: null, checked: null } },
      price: { rows: [{ label: { de: 'A', en: 'A' }, value: { de: '0', en: '0' }, tone: 'free', source: null, checked: null }] },
    },
  },
};

test('an unchanged unsourced value is allowed', () => {
  assert.deepEqual(changedWithoutSource(base, structuredClone(base)), []);
});

test('a changed score without a source is rejected', () => {
  const next = structuredClone(base);
  next.tools.alpha.score.value = 85;
  const problems = changedWithoutSource(base, next);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /alpha.*score/);
});

test('a changed score with a source and date is allowed', () => {
  const next = structuredClone(base);
  next.tools.alpha.score = {
    value: 85, source: 'https://example.com/changelog', checked: '2026-08-10', provenance: 'sourced',
  };
  assert.deepEqual(changedWithoutSource(base, next), []);
});

test('a changed score with a source but no checked date is rejected', () => {
  const next = structuredClone(base);
  next.tools.alpha.score = { value: 85, source: 'https://example.com', checked: null };
  assert.match(changedWithoutSource(base, next)[0], /checked/);
});

test('a changed matrix state without a source is rejected', () => {
  const next = structuredClone(base);
  next.tools.alpha.matrix['mcp-support'].state = 'partial';
  assert.match(changedWithoutSource(base, next)[0], /mcp-support/);
});

test('a new tool with unsourced values is rejected', () => {
  const next = structuredClone(base);
  next.tools.beta = structuredClone(base.tools.alpha);
  const problems = changedWithoutSource(base, next);
  assert.ok(problems.some((p) => p.includes('beta')));
});
```

- [ ] **Step 2: Run and confirm it fails**

```bash
node --test scripts/
```
Expected: FAIL — `changedWithoutSource is not exported`

- [ ] **Step 3: Implement**

Append to `scripts/verify.mjs` (before the `isMain` block):

```js
/**
 * Walks two tools.json snapshots in parallel and reports any data point whose
 * value moved without gaining a real source and checked date.
 */
export function changedWithoutSource(previous, current) {
  const problems = [];

  const isDataPoint = (node) =>
    node && typeof node === 'object' && ('source' in node || 'provenance' in node);

  const valueOf = (node) => {
    const { source, checked, provenance, ...rest } = node;
    return JSON.stringify(rest);
  };

  const check = (path, before, after) => {
    if (isDataPoint(after)) {
      const moved = before === undefined || valueOf(before) !== valueOf(after);
      if (moved) {
        if (!after.source) problems.push(`${path}: value changed without a source`);
        else if (!after.checked) problems.push(`${path}: value changed without a checked date`);
      }
      return;
    }
    if (Array.isArray(after)) {
      after.forEach((item, i) => check(`${path}[${i}]`, before?.[i], item));
      return;
    }
    if (after && typeof after === 'object') {
      for (const [key, value] of Object.entries(after)) {
        check(path ? `${path}.${key}` : key, before?.[key], value);
      }
    }
  };

  check('', previous.tools ?? {}, current.tools ?? {});
  return problems;
}

export function previousData() {
  try {
    const json = execFileSync('git', ['show', 'HEAD:data/tools.json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(json);
  } catch {
    return null; // no committed baseline yet, or not a git checkout
  }
}
```

`execFileSync` is already imported at the head of the file from Task 6 — no
further import is needed.

- [ ] **Step 4: Wire it into the CLI**

In the `isMain` block, after computing `failures`, insert:

```js
  const previous = previousData();
  const unsourcedChanges = previous ? changedWithoutSource(previous, data) : [];
  if (unsourcedChanges.length > 0) {
    failures.push(...unsourcedChanges.map((p) => `sourcing: ${p}`));
  }
```

Move the `if (failures.length === 0)` reporting block below this insertion so the new failures are included in the count.

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
node --test scripts/
```
Expected: PASS, 36 tests.

- [ ] **Step 6: Confirm spec criterion 4 by hand**

```bash
node -e "
const fs=require('fs');
const d=JSON.parse(fs.readFileSync('data/tools.json','utf8'));
d.tools.langgraph.score.value=91;
fs.writeFileSync('data/tools.json', JSON.stringify(d,null,2)+'\n');
"
node scripts/verify.mjs; echo "exit=$? (expected 1, citing sourcing)"
git checkout data/tools.json
node scripts/verify.mjs; echo "exit=$? (expected 0, restored)"
```

Expected: the first run fails naming `tools.langgraph.score: value changed without a source` **and** the HTML mismatch, since the JSON no longer matches the page. Both are correct.

- [ ] **Step 7: Commit**

```bash
git add scripts/verify.mjs scripts/verify.test.mjs
git commit -m "feat: block data changes that arrive without a source

Diffs data/tools.json against HEAD. Values may stay legacy-unsourced
indefinitely, but any value that moves must carry a source URL and a
checked date. Implements CLAUDE.md rule 1 for new data without
retroactively demanding citations the site never had."
```

---

### Task 8: Record the decisions

**Files:**
- Create: `docs/decisions/001-json-asserts-html-serves.md`
- Create: `docs/decisions/002-sourcing-applies-to-changes.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing.
- Produces: durable rationale. `CLAUDE.md` already instructs every agent to read `docs/decisions/` before planning, so these become load-bearing.

- [ ] **Step 1: Write ADR 001**

Create `docs/decisions/001-json-asserts-html-serves.md`, following `000-template.md`:

```markdown
# ADR-001: data/tools.json asserts, HTML serves

Date: 2026-08-10
Status: accepted

## Decision
`data/tools.json` is an assertion about what `index.html` and
`index.en.html` must contain, not a template they are generated from.
Both HTML files stay hand-edited and remain the served artifact.
`scripts/verify.mjs` proves the three agree.

## Context
The two HTML files are 88% identical and every score exists twice. The
168-cell feature matrix was positional, and matrix column order differs
from score-grid order, so a positional edit could silently corrupt the
wrong tool's row. Generating the HTML from JSON would fix the
duplication but means templatizing two working 2000-line files — a
rewrite, plus a permanent build step against the simplicity rule — for
a payoff that scales with a cadence of roughly six update rounds a year.

## Consequences
Data is still entered twice, but disagreement is now caught
mechanically rather than by reviewer attention. The verifier is
useful standalone and needs no build. If the update cadence rises
enough to justify generation, `tools.json` is already the input it
would need, so this defers that work rather than blocking it.
```

- [ ] **Step 2: Write ADR 002**

Create `docs/decisions/002-sourcing-applies-to-changes.md`:

```markdown
# ADR-002: Sourcing is enforced on changes, not on history

Date: 2026-08-10
Status: accepted

## Decision
Existing data points carry `provenance: "legacy-unsourced"` with a null
source. `scripts/verify.mjs` reports how many remain uncited but does
not fail on them. It fails when a value *changes* without gaining a
real source URL and a checked date.

## Context
`CLAUDE.md` rule 1 requires a source next to every data point. When the
verification work began, zero of the site's 222 data points had one.
Enforcing the rule retroactively would have left two options: block all
updates until every historical number was researched, or let an agent
attach plausible-looking citations to numbers it had not verified. The
second is worse than no citation at all, because it looks like rigour.

## Consequences
The gap is visible and counted on every run instead of being papered
over. Each refresh round closes part of it naturally, since any value
that moves must be sourced to move. Numbers that never change may stay
uncited indefinitely — an accepted trade for never publishing an
invented source.
```

- [ ] **Step 3: Add a pointer to `CLAUDE.md`**

Under the `## Non-negotiable standards` heading, extend rule 1:

Before:
```
1. **Data integrity.** Never change a score, ranking, or tool claim
   without a verifiable source (docs, changelog, release notes). Cite
   the source next to the data point. No source → no change.
```

After:
```
1. **Data integrity.** Never change a score, ranking, or tool claim
   without a verifiable source (docs, changelog, release notes). Cite
   the source next to the data point. No source → no change.
   Enforced by `npm run verify` against `data/tools.json`; see
   ADR-001 and ADR-002 for what is and is not checked.
```

- [ ] **Step 4: Verify everything still passes**

```bash
node --test scripts/ && node scripts/verify.mjs; echo "exit=$?"
```
Expected: all tests pass, verifier exits 0.

- [ ] **Step 5: Commit**

```bash
git add docs/decisions/001-json-asserts-html-serves.md \
        docs/decisions/002-sourcing-applies-to-changes.md CLAUDE.md
git commit -m "docs: record ADRs for the verification approach"
```

---

## Done when

All of the following hold on a clean checkout:

1. `node --test scripts/` — 36 tests pass.
2. `node scripts/verify.mjs` — exits 0, reports `0/222 data points cited`.
3. Changing one score in `index.html` alone makes it exit 1 naming that tool and file.
4. Changing one chip state in `index.en.html` alone makes it exit 1.
5. Changing a value in `data/tools.json` without a source makes it exit 1.
6. `git diff` against the pre-Task-1 tree shows only added attributes in the two HTML files — no text, CSS, or JS changes.
7. No `node_modules/`, no lockfile, no dependencies in `package.json`.

## Deliberately not in this plan

- The `/refresh` pipeline and `researcher` subagent — spec Phase 2.
- CI workflows and Pages deploy — spec Phase 3.
- Deleting the stale `agentic-workflow/` duplicate — real, but unrelated to verification; belongs in its own change.
- Backfilling actual source URLs — that is what the first `/refresh` round is for.
