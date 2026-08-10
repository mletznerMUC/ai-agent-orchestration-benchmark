import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sliceBetween, parseScores, parseMatrix, parsePrices, parseMeta } from './parse-html.mjs';

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
