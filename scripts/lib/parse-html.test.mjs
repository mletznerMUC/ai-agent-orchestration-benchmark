import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  sliceBetween, parseScores, parseMatrix, parsePrices, parseMeta,
  parseWeights, parseDimensions,
} from './parse-html.mjs';

const root = new URL('../../', import.meta.url);
const DE = readFileSync(new URL('index.html', root), 'utf8');
const EN = readFileSync(new URL('index.en.html', root), 'utf8');

const TOOL_KEYS = [
  'maestro', 'langgraph', 'google-adk', 'strands', 'databricks', 'crewai',
  'n8n', 'ms-agent', 'claude-sdk', 'claude-squad', 'openai-sdk', 'manus-ai',
];

// --- fixtures -------------------------------------------------------------

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

// --- sliceBetween ---------------------------------------------------------

test('sliceBetween returns the span between markers', () => {
  assert.equal(sliceBetween('aaXbbYcc', 'X', 'Y'), 'Xbb');
});

test('sliceBetween throws when the start marker is missing', () => {
  assert.throws(() => sliceBetween('abc', 'ZZZ', 'Y'), /marker not found: ZZZ/);
});

// --- parseScores ----------------------------------------------------------

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
  assert.ok(parseScores(SCORES_FIXTURE).has('beta'), 'is-top card must still key as beta');
});

test('parseScores throws when a card is missing its score number', () => {
  const broken = SCORES_FIXTURE.replace('<div class="score-number">84</div>', '');
  assert.throws(() => parseScores(broken), /alpha/);
});

test('parseScores finds all 12 tools in both real files', () => {
  for (const [name, html] of [['de', DE], ['en', EN]]) {
    const scores = parseScores(html);
    assert.equal(scores.size, 12, `${name}: expected 12 score cards`);
    for (const key of TOOL_KEYS) assert.ok(scores.has(key), `${name}: missing tool ${key}`);
  }
});

test('every score bar width matches its score in both real files', () => {
  for (const [name, html] of [['de', DE], ['en', EN]]) {
    for (const [key, { score, barWidth }] of parseScores(html)) {
      assert.equal(barWidth, score, `${name}/${key}: bar ${barWidth}% vs score ${score}`);
    }
  }
});

// --- parseMatrix ----------------------------------------------------------

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

// --- parsePrices / parseMeta ---------------------------------------------

test('parsePrices keys cards by data-tool, including the featured card', () => {
  assert.deepEqual([...parsePrices(PRICES_FIXTURE).keys()], ['alpha', 'beta']);
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

// --- parseWeights / parseDimensions ---------------------------------------

// Rows deliberately out of published order: keying must come from data-dim,
// never from position. accessibility and maturity share weight and max, so a
// swap between them is invisible to every check except the labels.
const DIMS_FIXTURE = `
  <div class="score-grid">
      <div class="score-card" data-tool="alpha">
        <div class="score-descriptor">Desktop Orchestrator</div>
        <details class="score-dims"><summary class="score-dims-sum">Aufschl&uuml;sselung</summary>
<div class="dim" data-dim="accessibility" data-max="6" data-raw="2"><span class="dim-name" title="Zug&auml;nglichkeit">Zug&auml;nglichkeit</span><span class="dim-raw">2/6</span><span class="dim-points">3.33</span></div>
<div class="dim" data-max="8" data-dim="orchestration" data-raw="4"><span class="dim-name" title="Orchestrierung">Orchestrierung</span><span class="dim-raw">4/8</span><span class="dim-points">12.5</span></div>
</details>
      </div>
      <div class="score-card is-unrated" data-tool="omega">
        <div class="score-descriptor">Autonomous Web Agent</div>
        <details class="score-dims"><summary class="score-dims-sum">Aufschl&uuml;sselung</summary>
<div class="dim is-unevidenced" data-dim="maturity" data-max="6" data-reason="nicht belegbar" title="nicht belegbar"><span class="dim-name" title="Release-Reife">Release-Reife</span><span class="dim-raw">&mdash;</span><span class="dim-points">nicht belegt</span></div>
</details>
      </div>
  </div>
  <!-- Feature Matrix -->
`;

const WEIGHTS_FIXTURE = `
  <!-- Methodology -->
      <table class="method-table">
        <tbody>
        <tr data-dim="maturity"><td>Release-Reife</td><td class="w">15</td><td class="c"><code>ga-status</code></td></tr>
        <tr data-dim="orchestration"><td>Orchestrierung</td><td class="w">25</td><td class="c"><code>playbooks</code></td></tr>
        <tr data-dim="accessibility"><td>Zug&auml;nglichkeit</td><td class="w">10</td><td class="c"><code>desktop-gui</code></td></tr>
        <tr data-dim="operability"><td>Betreibbarkeit</td><td class="w">20</td><td class="c"><code>hitl</code></td></tr>
        <tr data-dim="sovereignty"><td>Deployment-Souver&auml;nit&auml;t</td><td class="w">15</td><td class="c"><code>eu-onprem</code></td></tr>
        <tr data-dim="integration"><td>Integration</td><td class="w">15</td><td class="c"><code>cli-cicd</code></td></tr>
        </tbody>
      </table>
  <!-- News / Changelog -->
`;

test('parseDimensions keys rows by data-dim, not by position', () => {
  const rows = parseDimensions(DIMS_FIXTURE).get('alpha');
  assert.deepEqual(rows.map((r) => r.key), ['accessibility', 'orchestration']);
  assert.deepEqual(rows[0], {
    key: 'accessibility',
    name: 'Zug&auml;nglichkeit',
    title: 'Zug&auml;nglichkeit',
    raw: 2,
    max: 6,
    points: 3.33,
    pointsText: '3.33',
    rawLabel: '2/6',
  });
  // Attributes are read by name: this row writes data-max before data-dim.
  assert.equal(rows[1].max, 8);
  assert.equal(rows[1].raw, 4);
  assert.equal(rows[1].points, 12.5);
});

test('parseDimensions reads a dim-name that carries a title attribute', () => {
  const row = parseDimensions(DIMS_FIXTURE).get('alpha')[0];
  assert.equal(row.name, 'Zug&auml;nglichkeit');
  assert.equal(row.title, 'Zug&auml;nglichkeit');
});

test('parseDimensions reports an unevidenced row as raw null, points null', () => {
  const row = parseDimensions(DIMS_FIXTURE).get('omega')[0];
  assert.equal(row.raw, null);
  assert.equal(row.points, null);
  assert.equal(row.max, 6);
  assert.equal(row.rawLabel, '&mdash;');
});

test('parseDimensions throws on a card with no dimension rows', () => {
  assert.throws(() => parseDimensions(SCORES_FIXTURE), /alpha.*no dimension rows/);
});

test('parseDimensions throws on a row without data-dim', () => {
  const broken = DIMS_FIXTURE.replace(' data-dim="accessibility"', '');
  assert.throws(() => parseDimensions(broken), /without data-dim/);
});

test('parseDimensions throws on a row without data-max', () => {
  const broken = DIMS_FIXTURE.replace('data-dim="accessibility" data-max="6" ', 'data-dim="accessibility" ');
  assert.throws(() => parseDimensions(broken), /accessibility.*no data-max/);
});

test('parseDimensions throws when evidence and figure disagree about existing', () => {
  const noRaw = DIMS_FIXTURE.replace(' data-raw="2"', '');
  assert.throws(() => parseDimensions(noRaw), /accessibility.*data-raw is absent/);
  const noFigure = DIMS_FIXTURE.replace('<span class="dim-points">3.33</span>', '<span class="dim-points">nicht belegt</span>');
  assert.throws(() => parseDimensions(noFigure), /accessibility.*has data-raw/);
});

test('parseDimensions rejects a figure written with a decimal comma', () => {
  // One convention on both pages: a dot, in German too. A comma is not a
  // number here, so a localised figure fails rather than being accepted.
  const comma = DIMS_FIXTURE.replace('<span class="dim-points">3.33</span>',
    '<span class="dim-points">3,33</span>');
  assert.notEqual(comma, DIMS_FIXTURE, 'fixture did not match');
  assert.throws(() => parseDimensions(comma), /accessibility.*3,33/);
});

test('parseWeights reads the table in document order, keyed by data-dim', () => {
  const weights = parseWeights(WEIGHTS_FIXTURE);
  assert.deepEqual([...weights.keys()],
    ['maturity', 'orchestration', 'accessibility', 'operability', 'sovereignty', 'integration']);
  assert.deepEqual(weights.get('orchestration'), { label: 'Orchestrierung', weight: 25 });
});

test('parseWeights throws when the table has fewer than six dimensions', () => {
  assert.throws(() => parseWeights(WEIGHTS_FIXTURE.replace(/<tr data-dim="maturity">[\s\S]*?<\/tr>\n/, '')),
    /expected at least 6/);
});

const DIM_ORDER = [
  'orchestration', 'operability', 'integration', 'sovereignty', 'maturity', 'accessibility',
];
const DIM_WEIGHTS = [25, 20, 15, 15, 15, 10];
const DIM_LABELS = {
  de: ['Orchestrierung', 'Betreibbarkeit', 'Integration', 'Deployment-Souveränität',
    'Release-Reife', 'Zugänglichkeit'],
  en: ['Orchestration', 'Operability', 'Integration', 'Deployment sovereignty',
    'Release maturity', 'Accessibility'],
};

test('both real files publish the same six weights in the same order', () => {
  for (const [name, html] of [['de', DE], ['en', EN]]) {
    const weights = parseWeights(html);
    assert.deepEqual([...weights.keys()], DIM_ORDER, `${name}: dimension order`);
    assert.deepEqual([...weights.values()].map((w) => w.weight), DIM_WEIGHTS, `${name}: weights`);
    assert.deepEqual([...weights.values()].map((w) => w.label), DIM_LABELS[name],
      `${name}: labels — this is what catches an integration/maturity swap`);
  }
});

test('parseDimensions finds 12 cards x 6 rows in both real files', () => {
  for (const [name, html] of [['de', DE], ['en', EN]]) {
    const dims = parseDimensions(html);
    assert.equal(dims.size, 12, `${name}: expected 12 cards with dimension rows`);
    for (const key of TOOL_KEYS) {
      assert.deepEqual(dims.get(key)?.map((r) => r.key), DIM_ORDER, `${name}/${key}: rows`);
    }
    const total = [...dims.values()].reduce((n, rows) => n + rows.length, 0);
    assert.equal(total, 72, `${name}: expected 72 dimension rows`);
  }
});

test('the unrated card publishes no maturity figure in either real file', () => {
  for (const [name, html] of [['de', DE], ['en', EN]]) {
    const row = parseDimensions(html).get('manus-ai').find((r) => r.key === 'maturity');
    assert.equal(row.raw, null, `${name}: manus-ai maturity raw`);
    assert.equal(row.points, null, `${name}: manus-ai maturity points`);
  }
});
