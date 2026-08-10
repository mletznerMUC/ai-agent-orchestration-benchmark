import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectFailures, changedWithoutSource } from './verify.mjs';

const root = new URL('../', import.meta.url);
const DE = readFileSync(new URL('index.html', root), 'utf8');
const EN = readFileSync(new URL('index.en.html', root), 'utf8');
const DATA = JSON.parse(readFileSync(new URL('data/tools.json', root), 'utf8'));

// --- collectFailures ------------------------------------------------------

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
