/**
 * Guards the invariants the weighting panel could silently break.
 *
 * The panel sits between the score grid and the feature matrix, which means it
 * lands inside the slice parseScores reads (see docs/decisions/006). The
 * occurrence counts below are the real guard: they cover anything a future
 * editor drops anywhere in that slice, which a panel-only negative match
 * would miss entirely.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sliceBetween, parseScores, parseDimensions, parseWeights } from './lib/parse-html.mjs';
import { wtTotal } from './lib/rubric.mjs';

const root = new URL('../', import.meta.url);
const FILES = [
  ['index.html', readFileSync(new URL('index.html', root), 'utf8'), ','],
  ['index.en.html', readFileSync(new URL('index.en.html', root), 'utf8'), '.'],
];
const DATA = JSON.parse(readFileSync(new URL('data/tools.json', root), 'utf8'));
const RUBRIC = readFileSync(new URL('scripts/lib/rubric.mjs', root), 'utf8');

const RESERVED = [
  'score-number', 'score-bar-fill', 'score-descriptor',
  '<div class="score-card', '<div class="dim',
];

const count = (haystack, needle) => haystack.split(needle).length - 1;
const gridSlice = (html) => sliceBetween(html, '<div class="score-grid">', '<!-- Feature Matrix -->');
const panelSlice = (html) => sliceBetween(html, '<!-- Weighting Panel -->', '<!-- Feature Matrix -->');
const formula = (src) => sliceBetween(src, '/* wt-formula:begin */', '/* wt-formula:end */');

// --- reserved names inside the parseScores slice ---------------------------

test('the score-grid slice holds exactly the published markup it is parsed for', () => {
  const expected = {
    'score-number': 11,
    'score-bar-fill': 11,
    'score-descriptor': 12,
    '<div class="score-card': 12,
    '<details class="score-dims">': 12,
    '<div class="dim': 72,
  };
  for (const [name, html] of FILES) {
    const slice = gridSlice(html);
    for (const [needle, n] of Object.entries(expected)) {
      assert.equal(count(slice, needle), n, `${name}: ${needle} occurs ${count(slice, needle)}x, expected ${n}x`);
    }
  }
});

test('the weighting panel uses none of the reserved class names', () => {
  for (const [name, html] of FILES) {
    const panel = panelSlice(html);
    for (const needle of RESERVED) {
      assert.equal(count(panel, needle), 0, `${name}: panel must not contain ${needle}`);
    }
  }
});

test('the panel does not bleed into the parsed score cards', () => {
  for (const [name, html] of FILES) {
    const scores = parseScores(html);
    assert.equal(scores.size, 12, `${name}: expected 12 score cards`);
    const unrated = scores.get('manus-ai');
    assert.equal(unrated.score, null, `${name}: manus-ai must stay unrated`);
    assert.equal(unrated.barWidth, null, `${name}: manus-ai must have no bar`);
    assert.equal(unrated.descriptor, DATA.tools['manus-ai'].descriptor[name === 'index.html' ? 'de' : 'en'],
      `${name}: manus-ai descriptor drifted`);
  }
});

// --- the formula exists three times and is proven identical ----------------

test('all three copies of the weighting formula are byte-identical', () => {
  const copies = [...FILES.map(([, html]) => formula(html)), formula(RUBRIC)];
  assert.ok(copies[0].length > 0, 'no wt-formula block found');
  assert.equal(copies[0], copies[1], 'index.html and index.en.html disagree on the formula');
  assert.equal(copies[0], copies[2], 'the pages and scripts/lib/rubric.mjs disagree on the formula');
});

test('the two engines differ only in their strings block', () => {
  const stripped = FILES.map(([, html]) => {
    const engine = sliceBetween(html, '/* wt-engine:begin */', '/* wt-engine:end */');
    const strings = sliceBetween(engine, '/* wt-strings:begin */', '/* wt-strings:end */');
    assert.ok(strings.length > 0, 'no wt-strings block found');
    return engine.replace(strings, '');
  });
  assert.equal(stripped[0], stripped[1]);
});

// --- the panel's arithmetic reproduces the published rating ----------------

function published(html) {
  const weights = {};
  for (const [dim, { weight }] of parseWeights(html)) weights[dim] = weight;
  return weights;
}

function cardDims(html, sep) {
  const out = new Map();
  for (const [key, rows] of parseDimensions(html, sep)) {
    const dims = {};
    for (const row of rows) dims[row.key] = { raw: row.raw, max: row.max };
    out.set(key, dims);
  }
  return out;
}

test('recomputing from the published pages reproduces every published score', () => {
  for (const [name, html, sep] of FILES) {
    const weights = published(html);
    let rated = 0;
    for (const [key, dims] of cardDims(html, sep)) {
      const expected = DATA.tools[key].score.value;
      const total = wtTotal(weights, dims);
      assert.equal(total, expected, `${name} ${key}: recomputed ${total}, published ${expected}`);
      if (expected !== null) rated += 1;
    }
    assert.equal(rated, 11, `${name}: expected 11 rated tools`);
  }
});

test('an unevidenced dimension weighted 0 still yields no total', () => {
  for (const [name, html, sep] of FILES) {
    const weights = { ...published(html), maturity: 0 };
    const dims = cardDims(html, sep).get('manus-ai');
    assert.equal(wtTotal(weights, dims), null,
      `${name}: manus-ai must stay unrated even when maturity is weighted 0`);
  }
});

test('a weighting of nothing at all yields no total', () => {
  const [, html, sep] = FILES[0];
  const weights = Object.fromEntries(Object.keys(published(html)).map((d) => [d, 0]));
  for (const [, dims] of cardDims(html, sep)) {
    assert.equal(wtTotal(weights, dims), null);
  }
});
