/**
 * Zero-dependency extraction of benchmark data from the served HTML.
 *
 * These functions describe what the HTML *says*. They make no claim about
 * whether it is correct — that is verify.mjs's job.
 *
 * Everything is keyed by the `data-tool` / `data-feature` slug, never by
 * column index: the matrix column order differs from the score-grid order
 * (ms-agent/n8n and openai-sdk/claude-squad are swapped), so positional
 * lookup would silently attribute data to the wrong tool.
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

    // A card marked is-unrated publishes no number and no bar: under ADR-005 a
    // tool whose maturity cannot be evidenced at tier A carries no rating at
    // all rather than a guessed one.
    const unrated = /^[^>]*\bis-unrated\b/.test(chunk);

    if (descriptor === undefined) throw new Error(`score card ${key}: no score-descriptor`);
    if (unrated) {
      if (score !== undefined) throw new Error(`score card ${key}: is-unrated but has a score-number`);
      if (barWidth !== undefined) throw new Error(`score card ${key}: is-unrated but has a score bar`);
    } else {
      if (score === undefined) throw new Error(`score card ${key}: no score-number`);
      if (barWidth === undefined) throw new Error(`score card ${key}: no score-bar-fill width`);
    }

    scores.set(key, {
      score: unrated ? null : Number(score),
      barWidth: unrated ? null : Number(barWidth),
      descriptor: descriptor.trim(),
    });
  }

  return scores;
}

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
      throw new Error(`matrix row ${key}: ${chips.length} chips but ${toolOrder.length} tools`);
    }

    features.push({ key, label: label.trim(), desc: desc.trim() });
    toolOrder.forEach((toolKey, i) => cells.get(toolKey).set(key, chips[i]));
  }

  return { toolOrder, features, cells };
}

const PRICE_CARD_RE = /<div class="price-card(?: is-featured)?" data-tool="([^"]+)">/g;

export function parsePrices(html) {
  const block = sliceBetween(html, '<!-- Pricing -->', '<!-- Verdict -->');
  const starts = [...block.matchAll(PRICE_CARD_RE)];
  if (starts.length === 0) throw new Error('pricing: no price cards with data-tool found');

  const prices = new Map();

  starts.forEach((match, i) => {
    const key = match[1];
    const to = i + 1 < starts.length ? starts[i + 1].index : block.length;
    const chunk = block.slice(match.index, to);

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
