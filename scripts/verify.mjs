/**
 * Proves data/tools.json, index.html and index.en.html all agree.
 *
 * Exits non-zero listing every mismatch. Reports source coverage but does not
 * fail on legacy-unsourced values — see docs/decisions/002 for why. It does
 * fail when a value *changes* without gaining a source.
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
    for (const [label, map] of [['score grid', scores], ['matrix', matrix.cells], ['pricing', prices]]) {
      const found = [...map.keys()].sort();
      const expected = [...expectedTools].sort();
      const missing = expected.filter((k) => !found.includes(k));
      const extra = found.filter((k) => !expected.includes(k));
      if (missing.length) fail(`${file} ${label}: missing tools ${missing.join(', ')}`);
      if (extra.length) fail(`${file} ${label}: unexpected tools ${extra.join(', ')}`);
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

// Only run the CLI when invoked directly, never when imported by the tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../', import.meta.url);
  const de = readFileSync(new URL('index.html', root), 'utf8');
  const en = readFileSync(new URL('index.en.html', root), 'utf8');
  const data = JSON.parse(readFileSync(new URL('data/tools.json', root), 'utf8'));

  const failures = collectFailures(de, en, data);

  const previous = previousData();
  if (previous) {
    failures.push(...changedWithoutSource(previous, data).map((p) => `sourcing: ${p}`));
  }

  const { sourced, total } = sourceCoverage(data);

  if (failures.length === 0) {
    console.log('OK — index.html, index.en.html and data/tools.json agree.');
  } else {
    console.error(`FAIL — ${failures.length} mismatch(es):\n`);
    for (const f of failures) console.error(`  - ${f}`);
  }
  console.log(`\nsource coverage: ${sourced}/${total} data points cited ` +
    `(${total - sourced} still legacy-unsourced)`);

  process.exit(failures.length === 0 ? 0 : 1);
}
