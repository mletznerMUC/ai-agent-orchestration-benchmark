import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseScores, parseDimensions } from './lib/parse-html.mjs';
import { collectFailures, changedWithoutSource, rubricFailures } from './verify.mjs';

const root = new URL('../', import.meta.url);
const DE = readFileSync(new URL('index.html', root), 'utf8');
const EN = readFileSync(new URL('index.en.html', root), 'utf8');
const DATA = JSON.parse(readFileSync(new URL('data/tools.json', root), 'utf8'));

// Derived from the data, not hardcoded: these fixtures went stale silently
// once the rubric moved langgraph off 89, and a no-op replace made the tests
// pass while asserting nothing.
const LG = DATA.tools.langgraph.score.value;

// Which tools are unrated, and how many dimension figures the data expects to
// see published, are both things a refresh can move: a tool that gains tier-A
// maturity evidence becomes rated, gains a maturity figure, and leaves this
// set. Literals for either would fail on correct data, and since ADR-010
// apply.yml may not patch a test to get past that, so the round would block.
const UNRATED = Object.entries(DATA.tools)
  .filter(([, t]) => t.score.value === null)
  .map(([key]) => key);
const PUBLISHED_FIGURES = Object.values(DATA.tools)
  .flatMap((t) => Object.values(t.score.rubric))
  .filter((dim) => dim.raw !== null).length;

// --- collectFailures ------------------------------------------------------

test('the unmodified site verifies clean', () => {
  assert.deepEqual(collectFailures(DE, EN, DATA), []);
});

test('a score changed in the DE file only is caught', () => {
  const broken = DE.replace(
    `<div class="score-number">${LG}</div>`,
    `<div class="score-number">${LG + 2}</div>`,
  );
  assert.notEqual(broken, DE, 'fixture did not match — test would assert nothing');
  const failures = collectFailures(broken, EN, DATA);
  assert.ok(failures.some((f) => f.includes('langgraph') && f.includes(String(LG))),
    `expected a langgraph score failure, got: ${failures.join(' | ')}`);
});

test('a score bar desynced from its number is caught', () => {
  const broken = DE.replace(`style="width:${LG}%"`, `style="width:${LG + 6}%"`);
  assert.notEqual(broken, DE, 'fixture did not match — test would assert nothing');
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
  // The stamp moves every refresh round, so it is read from the data rather
  // than hardcoded — a stale literal here would make this test assert nothing.
  const broken = DE.replace(`Stand: ${DATA.meta.asOf.de}`, 'Stand: Juli 2026');
  assert.notEqual(broken, DE, 'fixture did not match — test would assert nothing');
  const failures = collectFailures(broken, EN, DATA);
  assert.ok(failures.some((f) => f.toLowerCase().includes('as-of')),
    `expected an as-of failure, got: ${failures.join(' | ')}`);
});

test('a tool missing from tools.json but present in the HTML is caught', () => {
  const data = structuredClone(DATA);
  delete data.tools.n8n;
  const failures = collectFailures(DE, EN, data);
  assert.ok(failures.some((f) => f.includes('n8n')),
    `expected an n8n coverage failure, got: ${failures.join(' | ')}`);
});

// --- changedWithoutSource -------------------------------------------------

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
  assert.ok(changedWithoutSource(base, next).some((p) => p.includes('beta')));
});

// --- rubricFailures -------------------------------------------------------

test('the committed rubric reproduces every published score', () => {
  assert.deepEqual(rubricFailures(DATA), []);
});

test('a score that does not match its own rubric is caught', () => {
  const bent = structuredClone(DATA);
  bent.tools.langgraph.score.value += 3;
  const problems = rubricFailures(bent);
  assert.ok(problems.some((p) => p.includes('langgraph') && p.includes('rounds to')),
    `expected a rounding failure, got: ${problems.join(' | ')}`);
});

test('a dimension whose points contradict weight*raw/max is caught', () => {
  const bent = structuredClone(DATA);
  bent.tools.crewai.score.rubric.operability.points += 2;
  const problems = rubricFailures(bent);
  assert.ok(problems.some((p) => p.includes('crewai.operability')),
    `expected a dimension failure, got: ${problems.join(' | ')}`);
});

test('weights that no longer sum to 100 are caught', () => {
  const bent = structuredClone(DATA);
  bent.tools.n8n.score.rubric.maturity.weight = 20;
  const problems = rubricFailures(bent);
  assert.ok(problems.some((p) => p.includes('n8n') && p.includes('weights sum to')),
    `expected a weight failure, got: ${problems.join(' | ')}`);
});

test('an unrated tool must carry a null score, not a number', () => {
  const bent = structuredClone(DATA);
  bent.tools['manus-ai'].score.value = 70;
  const problems = rubricFailures(bent);
  assert.ok(problems.some((p) => p.includes('manus-ai') && p.includes('incomplete')),
    `expected an unrated failure, got: ${problems.join(' | ')}`);
});

test('the unrated card parses as a null score in both languages', () => {
  for (const html of [DE, EN]) {
    const card = parseScores(html).get('manus-ai');
    assert.equal(card.score, null);
    assert.equal(card.barWidth, null);
  }
});

// --- dimension breakdown --------------------------------------------------

// Every fixture below is derived from DATA, never from a typed-in number, and
// every one asserts it actually changed the file before trusting the result.
function figure(tool, dim) {
  const d = DATA.tools[tool].score.rubric[dim];
  return Math.floor(((d.weight * d.raw) / d.max) * 100 + 0.5) / 100;
}

/** Rewrites one dimension row of one card, addressed by data-tool + data-dim. */
function patchRow(html, tool, dim, rewrite) {
  const card = html.indexOf(`data-tool="${tool}"`);
  assert.notEqual(card, -1, `no card for ${tool}`);
  const attr = html.indexOf(`data-dim="${dim}"`, card);
  assert.notEqual(attr, -1, `no ${dim} row on the ${tool} card`);
  const from = html.lastIndexOf('<div class="dim', attr);
  const to = html.indexOf('</div>', attr) + '</div>'.length;
  return html.slice(0, from) + rewrite(html.slice(from, to)) + html.slice(to);
}

function patchMethodologyWeight(html, dim, rewrite) {
  const row = html.indexOf(`<tr data-dim="${dim}">`);
  assert.notEqual(row, -1, `no methodology row for ${dim}`);
  const to = html.indexOf('</tr>', row);
  return html.slice(0, row) + rewrite(html.slice(row, to)) + html.slice(to);
}

test('a dimension figure hand-altered in the DE file only is caught', () => {
  const was = figure('maestro', 'operability');
  const broken = patchRow(DE, 'maestro', 'operability',
    (r) => r.replace(`>${was}<`, `>${was + 1}<`));
  assert.notEqual(broken, DE, 'fixture did not match — test would assert nothing');
  const failures = collectFailures(broken, EN, DATA);
  assert.ok(failures.some((f) => f.includes('index.html maestro/operability')),
    `expected a maestro/operability figure failure, got: ${failures.join(' | ')}`);
  assert.ok(!failures.some((f) => f.includes('index.en.html')), 'EN must stay clean');
});

test('a data-raw hand-altered in the EN file only is caught', () => {
  const raw = DATA.tools.crewai.score.rubric.integration.raw;
  const broken = patchRow(EN, 'crewai', 'integration',
    (r) => r.replace(`data-raw="${raw}"`, `data-raw="${raw - 1}"`));
  assert.notEqual(broken, EN, 'fixture did not match — test would assert nothing');
  const failures = collectFailures(DE, broken, DATA);
  assert.ok(failures.some((f) => f.includes('index.en.html crewai/integration')),
    `expected a crewai/integration failure, got: ${failures.join(' | ')}`);
});

test('removing data-raw from a rated row is caught', () => {
  const raw = DATA.tools.n8n.score.rubric.sovereignty.raw;
  const broken = patchRow(DE, 'n8n', 'sovereignty', (r) => r.replace(` data-raw="${raw}"`, ''));
  assert.notEqual(broken, DE, 'fixture did not match — test would assert nothing');
  const failures = collectFailures(broken, EN, DATA);
  assert.ok(failures.some((f) => f.includes('n8n/sovereignty')),
    `expected an n8n/sovereignty failure, got: ${failures.join(' | ')}`);
});

test('a dimension label drifted from the Methodology table is caught', () => {
  const broken = patchRow(DE, 'langgraph', 'sovereignty',
    (r) => r.replace('>Deployment-Souveränität</span>', '>Governance</span>'));
  assert.notEqual(broken, DE, 'fixture did not match — test would assert nothing');
  const failures = collectFailures(broken, EN, DATA);
  assert.ok(failures.some((f) => f.includes('langgraph/sovereignty') && f.includes('Methodology label')),
    `expected a label failure, got: ${failures.join(' | ')}`);
});

test('a title drifted from its own dimension label is caught', () => {
  const broken = patchRow(EN, 'strands', 'accessibility',
    (r) => r.replace('title="Accessibility"', 'title="Usability"'));
  assert.notEqual(broken, EN, 'fixture did not match — test would assert nothing');
  const failures = collectFailures(DE, broken, DATA);
  assert.ok(failures.some((f) => f.includes('strands/accessibility') && f.includes('title')),
    `expected a title failure, got: ${failures.join(' | ')}`);
});

test('a Methodology weight that disagrees with tools.json is caught', () => {
  const w = DATA.tools.maestro.score.rubric.operability.weight;
  const broken = patchMethodologyWeight(DE, 'operability',
    (r) => r.replace(`<td class="w">${w}</td>`, `<td class="w">${w + 1}</td>`));
  assert.notEqual(broken, DE, 'fixture did not match — test would assert nothing');
  const failures = collectFailures(broken, EN, DATA);
  assert.ok(failures.some((f) => f.includes('operability') && f.includes('Methodology weight')),
    `expected a weight failure, got: ${failures.join(' | ')}`);
});

test('both files publish the same evidence and the same figures', () => {
  const de = parseDimensions(DE);
  const en = parseDimensions(EN);
  assert.deepEqual([...de.keys()], [...en.keys()]);
  for (const [key, rows] of de) {
    const other = en.get(key);
    assert.equal(rows.length, other.length, `${key}: row count differs`);
    rows.forEach((row, i) => {
      assert.equal(row.key, other[i].key, `${key} row ${i}: dimension differs`);
      assert.equal(row.raw, other[i].raw, `${key}/${row.key}: raw differs`);
      assert.equal(row.max, other[i].max, `${key}/${row.key}: max differs`);
      assert.equal(row.rawLabel, other[i].rawLabel, `${key}/${row.key}: evidence label differs`);
    });
  }
});

test('the dimension attributes and figures are byte-identical in both files', () => {
  const shape = (html) => [...html.matchAll(/data-dim="[a-z]+" data-max="\d+"( data-raw="\d+")?/g)]
    .map((m) => m[0]);
  assert.equal(shape(DE).length, 72, 'expected 72 dimension rows in the DE file');
  assert.deepEqual(shape(DE), shape(EN));

  const evidence = (html) => [...html.matchAll(/<span class="dim-raw">([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(evidence(DE), evidence(EN));

  // One decimal convention on both pages — a dot, in German too — so the
  // figures themselves compare byte-for-byte. The single row that is prose
  // rather than a figure ("nicht belegt" / "not evidenced") is language-bound
  // by design and is checked structurally instead: no data-raw on either page.
  const figures = (html) => [...parseDimensions(html)].flatMap(([key, rows]) => rows
    .filter((row) => row.raw !== null)
    .map((row) => `${key}/${row.key}=${row.points}`));
  const points = (html) => [...html.matchAll(/<span class="dim-points">([^<]*)<\/span>/g)]
    .map((m) => m[1]).filter((text) => /^\d/.test(text));
  assert.ok(PUBLISHED_FIGURES > 0, 'tools.json declares no published figures — this would assert nothing');
  assert.equal(points(DE).length, PUBLISHED_FIGURES,
    `DE publishes ${points(DE).length} figures, tools.json declares ${PUBLISHED_FIGURES}`);
  assert.deepEqual(points(DE), points(EN), 'the two files disagree on a figure string');
  assert.deepEqual(figures(DE), figures(EN));
  assert.ok(!points(DE).some((text) => text.includes(',')), 'no figure may use a decimal comma');
  assert.ok(!points(EN).some((text) => text.includes(',')), 'no figure may use a decimal comma');
});

test('an unrated card publishes no maturity figure in either language', () => {
  // Which tool is unrated comes from the data. Naming one here meant the test
  // silently stopped covering the rule if a different tool became the unrated
  // one, and broke confusingly if that tool became rated.
  assert.ok(UNRATED.length > 0,
    'every tool in tools.json is now rated, so this test has no subject and is '
    + 'asserting nothing. That is a real change, not a fault: the unrated '
    + 'presentation would be dead markup on both pages. Decide deliberately '
    + 'whether to retire this test and that markup, rather than letting it pass '
    + 'empty.');
  for (const html of [DE, EN]) {
    for (const key of UNRATED) {
      const rows = parseDimensions(html).get(key);
      assert.ok(rows, `${key}: no dimension rows on the published card`);
      const maturity = rows.find((r) => r.key === 'maturity');
      assert.equal(maturity.raw, null, `${key}: maturity must publish no figure`);
      assert.equal(maturity.points, null, `${key}: maturity must publish no points`);
      // Maturity is the only dimension a tier-A absence can unevidence, so an
      // unrated card carries exactly one such row however many tools move.
      assert.equal(rows.filter((r) => r.raw === null).length, 1,
        `${key}: expected exactly one unevidenced row`);
    }
  }
});
