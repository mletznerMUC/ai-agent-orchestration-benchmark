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
import {
  parseScores, parseMatrix, parsePrices, parseMeta, parseWeights, parseDimensions,
} from './lib/parse-html.mjs';

// Display rounding: half-up to two decimals. Only ever applied to what the
// page shows — never to the arithmetic (ADR-006, D4).
const displayPoints = (weight, raw, max) => Math.floor(((weight * raw) / max) * 100 + 0.5) / 100;

/**
 * Checks one tool's published rubric breakdown against data/tools.json.
 *
 * The weights come from the Methodology table, which is the page's only copy
 * of them (D2), so a weight edited there and nowhere else is caught here too.
 */
function checkDimensions({ file, key, tool, rows, weights, fail }) {
  const rubric = tool.score?.rubric;
  if (!rubric) {
    fail(`${file} ${key}: tools.json has no score.rubric to check the card against`);
    return;
  }

  const shown = rows.map((r) => r.key);
  const expectedSet = Object.keys(rubric).sort();
  if (JSON.stringify([...shown].sort()) !== JSON.stringify(expectedSet)) {
    fail(`${file} ${key}: card dimensions ${shown.join(', ')} != rubric ${Object.keys(rubric).join(', ')}`);
    return;
  }

  const order = [...weights.keys()];
  if (JSON.stringify(shown) !== JSON.stringify(order)) {
    fail(`${file} ${key}: dimension order ${shown.join(', ')} != Methodology order ${order.join(', ')}`);
  }

  let total = 0;
  for (const row of rows) {
    const d = rubric[row.key];
    const published = weights.get(row.key);
    const at = `${file} ${key}/${row.key}`;

    if (!published) {
      fail(`${at}: no Methodology row publishes a weight for this dimension`);
      continue;
    }
    if (published.weight !== d.weight) {
      fail(`${at}: Methodology weight ${published.weight}, tools.json says ${d.weight}`);
      continue;
    }
    if (row.name !== published.label) {
      fail(`${at}: label "${row.name}" != Methodology label "${published.label}"`);
    }
    if (row.title !== row.name) {
      fail(`${at}: title "${row.title}" != its own label "${row.name}"`);
    }
    if (row.max !== d.max) {
      fail(`${at}: max ${row.max}, tools.json says ${d.max}`);
    }
    if (row.raw !== d.raw) {
      const has = row.raw === null ? 'no data-raw' : `data-raw ${row.raw}`;
      const want = d.raw === null ? 'null' : d.raw;
      fail(`${at}: ${has}, tools.json says ${want}`);
      continue;
    }
    if (d.raw === null) {
      if (row.points !== null) fail(`${at}: shows a figure but tools.json has no raw score`);
      continue;
    }

    const expected = displayPoints(published.weight, d.raw, d.max);
    if (row.points !== expected) {
      fail(`${at}: figure ${row.points} != weight*raw/max rounded to 2dp ${expected}`);
    }
    if (row.rawLabel !== `${d.raw}/${d.max}`) {
      fail(`${at}: evidence label "${row.rawLabel}" != "${d.raw}/${d.max}"`);
    }
    total += (published.weight * d.raw) / d.max;
  }

  // The total is checked at full precision, never from the rounded figures.
  if (tool.score.value === null) {
    if (!rows.some((r) => r.raw === null)) {
      fail(`${file} ${key}: tools.json says unrated but every dimension on the card carries evidence`);
    }
    return;
  }
  if (Math.abs(total - tool.score.exact) > 0.005) {
    fail(`${file} ${key}: dimensions on the card sum to ${total.toFixed(4)}, score.exact says ${tool.score.exact}`);
  }
  if (Math.floor(total + 0.5) !== tool.score.value) {
    fail(`${file} ${key}: dimensions on the card round to ${Math.floor(total + 0.5)}, score says ${tool.score.value}`);
  }
}

export function collectFailures(deHtml, enHtml, data) {
  const failures = [];
  const fail = (msg) => failures.push(msg);

  const files = [['index.html', deHtml, 'de'], ['index.en.html', enHtml, 'en']];
  const expectedTools = Object.keys(data.tools);

  for (const [file, html, lang] of files) {
    let scores, matrix, prices, meta, weights, dimensions;
    try {
      scores = parseScores(html);
      matrix = parseMatrix(html);
      prices = parsePrices(html);
      meta = parseMeta(html);
      weights = parseWeights(html);
      dimensions = parseDimensions(html);
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
          const shown = card.score === null ? 'unrated' : card.score;
          const want = tool.score.value === null ? 'unrated' : tool.score.value;
          fail(`${file} ${key}: score is ${shown}, tools.json says ${want}`);
        }
        if (card.score !== null && card.barWidth !== card.score) {
          fail(`${file} ${key}: score bar is ${card.barWidth}% but score is ${card.score}`);
        }
        if (card.descriptor !== tool.descriptor[lang]) {
          fail(`${file} ${key}: descriptor "${card.descriptor}" != "${tool.descriptor[lang]}"`);
        }
      }

      const rows = dimensions.get(key);
      if (rows) checkDimensions({ file, key, tool, rows, weights, fail });

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

/**
 * The published score must be reproducible from its own rubric (ADR-005):
 * the six dimension points sum to score.exact, and score.exact rounds
 * half-up to score.value. This is what stops the rating being an assertion.
 */
export function rubricFailures(data) {
  const problems = [];
  const halfUp = (x) => Math.floor(x + 0.5);

  for (const [key, tool] of Object.entries(data.tools ?? {})) {
    const { value, exact, rubric } = tool.score ?? {};
    if (!rubric) {
      problems.push(`${key}: score has no rubric`);
      continue;
    }

    const points = Object.values(rubric).map((d) => d.points);
    const unrated = points.some((p) => p === null);

    if (unrated) {
      if (value !== null) problems.push(`${key}: rubric is incomplete but score is ${value}, expected null`);
      if (exact !== null) problems.push(`${key}: rubric is incomplete but exact is ${exact}, expected null`);
      continue;
    }

    const weights = Object.values(rubric).reduce((a, d) => a + d.weight, 0);
    if (weights !== 100) problems.push(`${key}: rubric weights sum to ${weights}, expected 100`);

    for (const [name, d] of Object.entries(rubric)) {
      const expected = (d.weight * d.raw) / d.max;
      if (Math.abs(d.points - expected) > 0.005) {
        problems.push(`${key}.${name}: points ${d.points} != weight*raw/max ${expected.toFixed(4)}`);
      }
    }

    const sum = points.reduce((a, p) => a + p, 0);
    if (Math.abs(sum - exact) > 0.005) {
      problems.push(`${key}: dimension points sum to ${sum.toFixed(4)}, exact says ${exact}`);
    }
    if (halfUp(exact) !== value) {
      problems.push(`${key}: exact ${exact} rounds to ${halfUp(exact)}, score says ${value}`);
    }
  }

  return problems;
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

  failures.push(...rubricFailures(data).map((p) => `rubric: ${p}`));

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
