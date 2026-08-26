/**
 * Writes COST_CONTROL.md from this project's Claude Code session transcripts.
 *
 * Run it after every run: `npm run cost` (a SessionEnd hook does this
 * automatically — see .claude/settings.json). The file is regenerated whole
 * every time, so it is always a function of the transcripts on disk, never an
 * append-only log that can drift.
 *
 * Reads:
 *   ~/.claude/projects/<encoded-cwd>/*.jsonl                 main sessions
 *   ~/.claude/projects/<encoded-cwd>/<id>/subagents/*.jsonl   subagent runs
 *   data/model-pricing.json                                   published rates
 *   data/cost-ci-runs.json                                    optional, manual
 *
 * Env:
 *   CLAUDE_PROJECTS_DIR   override the transcript directory
 *   COST_RUN_LOG_LIMIT    sessions listed in the run log (default 30)
 *   COST_ALLOW_SHRINK     set to 1 to publish a ledger smaller than the
 *                         committed one (see the shrink guard in main)
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  collectFromTranscript,
  collectCommands,
  dedupe,
  aggregate,
  recordsFromManual,
  classifyWorkflow,
  recordedTotals,
  shrinkRefusal,
} from './lib/cost.mjs';

const ROOT = new URL('../', import.meta.url);
const RUN_LOG_LIMIT = Number(process.env.COST_RUN_LOG_LIMIT ?? 30);

// --- transcript discovery -------------------------------------------------

export function encodeProjectDir(cwd) {
  return cwd.replace(/[/.]/g, '-');
}

function projectsDir(repoRoot) {
  if (process.env.CLAUDE_PROJECTS_DIR) return process.env.CLAUDE_PROJECTS_DIR;
  return join(homedir(), '.claude', 'projects', encodeProjectDir(repoRoot));
}

function listSessionFiles(dir) {
  const main = [];
  const sub = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name.endsWith('.jsonl')) {
      main.push({ path, sessionId: basename(name, '.jsonl') });
      continue;
    }
    const subDir = join(path, 'subagents');
    if (!existsSync(subDir) || !statSync(path).isDirectory()) continue;
    for (const file of readdirSync(subDir)) {
      if (!file.endsWith('.jsonl')) continue;
      const metaPath = join(subDir, `${basename(file, '.jsonl')}.meta.json`);
      let agentType = 'subagent (type unrecorded)';
      let description = null;
      if (existsSync(metaPath)) {
        try {
          const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
          agentType = meta.agentType ?? agentType;
          description = meta.description ?? null;
        } catch {
          // A meta file we cannot parse leaves the agent type unrecorded rather
          // than dropping the spend.
        }
      }
      sub.push({ path: join(subDir, file), sessionId: name, agentType, description });
    }
  }
  return { main, sub };
}

function readProject(dir) {
  const { main, sub } = listSessionFiles(dir);
  const records = [];
  const commandsBySession = new Map();
  const subagentTasks = [];

  for (const file of main) {
    const text = readFileSync(file.path, 'utf8');
    records.push(
      ...collectFromTranscript(text, {
        agent: 'orchestrator (main session)',
        sessionId: file.sessionId,
        source: 'main transcript',
      }),
    );
    const commands = collectCommands(text);
    if (commands.length) commandsBySession.set(file.sessionId, commands);
  }

  for (const file of sub) {
    const text = readFileSync(file.path, 'utf8');
    const found = collectFromTranscript(text, {
      agent: file.agentType,
      sessionId: file.sessionId,
      source: 'subagent transcript',
    });
    records.push(...found);
    if (found.length) {
      subagentTasks.push({
        agent: file.agentType,
        description: file.description,
        requests: found.length,
      });
    }
  }

  return { records, commandsBySession, sessionCount: main.length, subagentTasks };
}

// --- formatting -----------------------------------------------------------

const usd = (n) => `$${n.toFixed(n > 0 && n < 0.01 ? 4 : 2)}`;
const num = (n) => n.toLocaleString('en-US');
const tok = (n) => {
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 })}M`;
  if (n >= 1000) return `${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`;
  return num(n);
};

function table(header, rows) {
  if (!rows.length) return '_No data._\n';
  const line = `| ${header.join(' | ')} |`;
  const sep = `| ${header.map(() => '---').join(' | ')} |`;
  return [line, sep, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n') + '\n';
}

const bucketCells = (b) => [
  num(b.requests),
  tok(b.inputTokens),
  tok(b.cacheWriteTokens),
  tok(b.cacheReadTokens),
  tok(b.outputTokens),
  usd(b.usd),
];
const BUCKET_HEADER = ['Requests', 'Input', 'Cache write', 'Cache read', 'Output', 'Cost'];

const sortedByUsd = (map) => [...map.entries()].sort((a, b) => b[1].usd - a[1].usd);
const sortedMonths = (map) => [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

// --- report ---------------------------------------------------------------

function render(agg, meta) {
  const { totals, months, agentsByMonth, workflowsByMonth, modelsByMonth, sessions, unpricedModels } = agg;
  const out = [];
  const p = (s = '') => out.push(s);

  p('# Cost Control');
  p();
  p(`_Generated by \`npm run cost\` on ${meta.generatedAt}. Do not edit by hand — every`);
  p('run overwrites this file._');
  p();
  p('## What this number is');
  p();
  p('Token usage recorded in this project\'s Claude Code session transcripts, valued at');
  p('the published Claude API list prices in [`data/model-pricing.json`](data/model-pricing.json).');
  p();
  p('It is an **estimate of consumption, not an invoice**. Three reasons it can differ');
  p('from what Anthropic bills:');
  p();
  p('1. Sessions run under a Claude subscription are not billed per token at all. For');
  p('   those, read this as "what this work would have cost on the API".');
  p('2. Negotiated discounts, credits, and partner-platform (Bedrock, Google Cloud)');
  p('   rates are not modelled.');
  p('3. Runs with no local transcript are missing unless recorded manually — see');
  p('   [Coverage](#coverage) below.');
  p();
  p('## Totals to date');
  p();
  p(table(['Metric', 'Value'], [
    ['Cost (list price)', `**${usd(totals.usd)}**`],
    ['API requests', num(totals.requests)],
    ['Input tokens (uncached)', num(totals.inputTokens)],
    ['Cache write tokens', num(totals.cacheWriteTokens)],
    ['Cache read tokens', num(totals.cacheReadTokens)],
    ['Output tokens', num(totals.outputTokens)],
    ['Web searches', num(totals.webSearchRequests)],
    ['Sessions', num(sessions.size)],
    ['Months covered', num(months.size)],
  ]));
  p('## Cost per month');
  p();
  p(table(['Month', ...BUCKET_HEADER], sortedMonths(months).map(([month, b]) => [month, ...bucketCells(b)])));
  p('## Cost per agent per month');
  p();
  p('One row per agent. `orchestrator (main session)` is the interactive session that');
  p('runs the pipeline; every other row is a subagent, named by its agent type.');
  p();
  for (const [month, agents] of sortedMonths(agentsByMonth)) {
    p(`### ${month}`);
    p();
    p(table(['Agent', ...BUCKET_HEADER], sortedByUsd(agents).map(([agent, b]) => [agent, ...bucketCells(b)])));
  }
  p('## Cost per workflow per month');
  p();
  p('Attributed by the git branch each request ran on: `feature/*`, `hotfix/*` and');
  p('`refresh/*` are the three pipeline lines; work on `main` and other branches is');
  p('reported separately rather than folded into a line it did not belong to.');
  p();
  for (const [month, workflows] of sortedMonths(workflowsByMonth)) {
    p(`### ${month}`);
    p();
    p(table(['Workflow', ...BUCKET_HEADER], sortedByUsd(workflows).map(([w, b]) => [w, ...bucketCells(b)])));
  }
  p('## Cost per model per month');
  p();
  for (const [month, models] of sortedMonths(modelsByMonth)) {
    p(`### ${month}`);
    p();
    p(table(['Model', ...BUCKET_HEADER], sortedByUsd(models).map(([m, b]) => [m, ...bucketCells(b)])));
  }

  const runs = [...sessions.values()].sort((a, b) => (a.last ?? '') < (b.last ?? '') ? 1 : -1);
  const shown = runs.slice(0, RUN_LOG_LIMIT);
  p('## Run log');
  p();
  if (runs.length > shown.length) {
    p(`Most recent ${shown.length} of ${runs.length} sessions, newest first.`);
    p(`The other ${runs.length - shown.length} are counted in every total above but not`);
    p('listed here; raise `COST_RUN_LOG_LIMIT` to list more.');
  } else {
    p(`All ${runs.length} sessions, newest first.`);
  }
  p();
  p(table(
    ['Date', 'Session', 'Commands', 'Agents', 'Branches', 'Requests', 'Cost'],
    shown.map((r) => [
      (r.last ?? 'unknown').slice(0, 10),
      `\`${r.id.slice(0, 8)}\``,
      (meta.commandsBySession.get(r.id) ?? []).join(', ') || '—',
      [...r.agents].sort().join(', '),
      [...r.branches].sort().join(', ') || '—',
      num(r.requests),
      usd(r.usd),
    ]),
  ));

  p('## Pricing basis');
  p();
  p(`Source: ${meta.pricing.meta.source} — checked ${meta.pricing.meta.checked}.`);
  p(`Prices are ${meta.pricing.meta.unit} in ${meta.pricing.meta.currency}.`);
  p();
  const m = meta.pricing.multipliers;
  p(table(['Model', 'Input', 'Output', `Cache write 5m (${m.cache_write_5m}x)`, `Cache write 1h (${m.cache_write_1h}x)`, `Cache read (${m.cache_read}x)`],
    Object.entries(meta.pricing.models)
      .filter(([key]) => meta.usedModels.has(key))
      .map(([key, r]) => [
        key,
        usd(r.input),
        usd(r.output),
        usd(r.input * m.cache_write_5m),
        usd(r.input * m.cache_write_1h),
        usd(r.input * m.cache_read),
      ])));
  p(`Only models this project actually used are listed; the full table is in`);
  p('[`data/model-pricing.json`](data/model-pricing.json).');
  p();
  p(`Web search is billed at $${meta.pricing.server_tools.web_search_usd_per_1000_requests} per 1,000 searches; web fetch adds no charge`);
  p('beyond the tokens it pulls into context. Fast mode, where a transcript reports it,');
  p(`is priced at its own premium rate. \`inference_geo: "us"\` applies a ${m.inference_geo_us}x multiplier.`);
  p();
  p('## Coverage');
  p();
  p('What this ledger sees, and what it does not:');
  p();
  p('- **Covered:** every local Claude Code session for this project, including each');
  p('  subagent run (`researcher`, `scout`, `planner`, `implementer`, `reviewer`, …),');
  p('  because subagents write their own transcripts.');
  p('- **Not covered automatically:** runs with no transcript on this machine — the');
  p('  scheduled `refresh-research` and `apply` GitHub Actions runs, which call');
  p('  `anthropics/claude-code-action` with a real API key, and any session run on');
  p('  another machine. These are genuine API spend and are the largest known gap.');
  p('- **How to close it:** record them in `data/cost-ci-runs.json` as an array of');
  p('  entries; the next `npm run cost` prices them alongside the transcripts.');
  p();
  p('```json');
  p('[');
  p('  {');
  p('    "date": "2026-08-01",');
  p('    "agent": "refresh-research (CI)",');
  p('    "branch": "refresh/2026-08",');
  p('    "model": "claude-opus-5",');
  p('    "input_tokens": 0,');
  p('    "output_tokens": 0,');
  p('    "cache_write_5m_tokens": 0,');
  p('    "cache_read_tokens": 0,');
  p('    "web_search_requests": 0,');
  p('    "source": "gh run view <run-id>"');
  p('  }');
  p(']');
  p('```');
  p();
  if (meta.manualCount) {
    p(`${meta.manualCount} manually recorded run(s) from \`data/cost-ci-runs.json\` are included above.`);
  } else {
    p('`data/cost-ci-runs.json` is currently absent or empty, so no CI spend is included.');
  }
  p();
  if (unpricedModels.size) {
    p(`**Unpriced models:** ${[...unpricedModels].join(', ')} — used but missing from`);
    p('`data/model-pricing.json`, so their requests count in the token columns and');
    p(`contribute $0.00 to every cost column (${num(totals.unpricedRequests)} request(s)). Add the rate,`);
    p('with its source, to fix the understatement.');
    p();
  }
  p('Two further limits worth stating: a request is attributed to the branch checked');
  p('out when it ran, so work done on `main` before branching lands under `main`; and');
  p('cache-write tokens from older transcripts that report no TTL split are priced at');
  p('the cheaper 5-minute rate, which understates rather than inflates.');
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

// --- main -----------------------------------------------------------------

function main() {
  const repoRoot = fileURLToPath(ROOT).replace(/\/$/, '');
  const dir = projectsDir(repoRoot);
  if (!existsSync(dir)) {
    console.error(`cost: no transcript directory at ${dir}`);
    console.error('cost: set CLAUDE_PROJECTS_DIR if transcripts live elsewhere.');
    process.exit(1);
  }

  const pricing = JSON.parse(readFileSync(new URL('data/model-pricing.json', ROOT), 'utf8'));
  const { records, commandsBySession, subagentTasks } = readProject(dir);

  const manualPath = new URL('data/cost-ci-runs.json', ROOT);
  let manual = [];
  if (existsSync(fileURLToPath(manualPath))) {
    const parsed = JSON.parse(readFileSync(manualPath, 'utf8'));
    manual = recordsFromManual(Array.isArray(parsed) ? parsed : (parsed.runs ?? []));
  }

  const all = [...dedupe(records), ...manual];
  if (!all.length) {
    console.error(`cost: no priced requests found in ${dir}`);
    process.exit(1);
  }

  const agg = aggregate(all, pricing);
  const usedModels = new Set([...agg.modelsByMonth.values()].flatMap((m) => [...m.keys()]));
  const markdown = render(agg, {
    generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    pricing,
    commandsBySession,
    manualCount: manual.length,
    usedModels,
  });

  const outPath = new URL('COST_CONTROL.md', ROOT);
  const outFile = fileURLToPath(outPath);

  // The ledger only ever grows on the machine that does the work, so a run
  // reporting less than the committed file is a machine that cannot see the
  // history — an ephemeral cloud container, a fresh clone, a pruned cache.
  // Refuse rather than publish a total that is an order of magnitude too low.
  const previous = existsSync(outFile) ? recordedTotals(readFileSync(outFile, 'utf8')) : null;
  const refusal = shrinkRefusal(previous, {
    requests: agg.totals.requests,
    sessions: agg.sessions.size,
  });
  if (refusal && process.env.COST_ALLOW_SHRINK !== '1') {
    console.error(`cost: refusing to overwrite COST_CONTROL.md — it would shrink (${refusal}).`);
    console.error(`cost: only ${agg.totals.requests} request(s) are visible in ${dir},`);
    console.error('cost: which is fewer than the committed ledger records. This machine');
    console.error('cost: cannot see the full transcript history, so the file is left as is.');
    console.error('cost: if the shrink is intended, rerun with COST_ALLOW_SHRINK=1.');
    process.exit(1);
  }

  writeFileSync(outPath, markdown.endsWith('\n') ? markdown : `${markdown}\n`);
  console.log(
    `cost: COST_CONTROL.md updated — ${agg.totals.requests} requests, ` +
      `${agg.sessions.size} sessions, ${subagentTasks.length} subagent runs, ` +
      `${usd(agg.totals.usd)} at list price.`,
  );
  if (agg.unpricedModels.size) {
    console.warn(`cost: unpriced models present: ${[...agg.unpricedModels].join(', ')}`);
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main();

export { render, readProject, classifyWorkflow };
