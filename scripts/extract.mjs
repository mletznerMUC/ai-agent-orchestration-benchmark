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
const enScores = parseScores(en);
const deMatrix = parseMatrix(de);
const enMatrix = parseMatrix(en);
const dePrices = parsePrices(de);
const enPrices = parsePrices(en);

const tools = {};
for (const [key, { score, descriptor }] of deScores) {
  const enScore = enScores.get(key);
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
  if (!dePrice || !enPrice) throw new Error(`${key}: missing price card in DE or EN`);
  if (dePrice.rows.length !== enPrice.rows.length) {
    throw new Error(`${key}: DE has ${dePrice.rows.length} price rows, EN has ${enPrice.rows.length}`);
  }

  tools[key] = {
    name: dePrice.name,
    score: { value: score, ...unsourced },
    descriptor: { de: descriptor, en: enScore.descriptor },
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
console.log(
  `wrote data/tools.json — ${Object.keys(tools).length} tools, ` +
  `${deMatrix.features.length} features, all values marked legacy-unsourced`,
);
