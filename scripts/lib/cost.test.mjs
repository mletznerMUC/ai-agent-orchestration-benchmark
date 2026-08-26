import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeModelId,
  resolveRate,
  priceRecord,
  extractRecord,
  collectFromTranscript,
  collectCommands,
  dedupe,
  classifyWorkflow,
  monthOf,
  aggregate,
  recordsFromManual,
  recordedTotals,
  shrinkRefusal,
} from './cost.mjs';

const PRICING = JSON.parse(
  readFileSync(new URL('../../data/model-pricing.json', import.meta.url), 'utf8'),
);

// --- fixtures -------------------------------------------------------------

function assistantEntry(overrides = {}, usage = {}) {
  return JSON.stringify({
    type: 'assistant',
    timestamp: '2026-08-11T15:46:12.237Z',
    sessionId: 'sess-1',
    gitBranch: 'hotfix/apply-refresh-2026-08',
    requestId: 'req_1',
    uuid: 'uuid-1',
    ...overrides,
    message: {
      id: 'msg_1',
      model: 'claude-opus-4-8',
      usage: {
        input_tokens: 100,
        output_tokens: 200,
        cache_creation_input_tokens: 1000,
        cache_read_input_tokens: 10000,
        cache_creation: { ephemeral_5m_input_tokens: 1000, ephemeral_1h_input_tokens: 0 },
        ...usage,
      },
      ...(overrides.message ?? {}),
    },
  });
}

const CONTEXT = { agent: 'orchestrator (main session)', sessionId: 'sess-1' };

// --- model ids ------------------------------------------------------------

test('normalizeModelId strips a dated snapshot suffix', () => {
  assert.equal(normalizeModelId('claude-haiku-4-5-20251001'), 'claude-haiku-4-5');
  assert.equal(normalizeModelId('claude-opus-5'), 'claude-opus-5');
  assert.equal(normalizeModelId(null), null);
  assert.equal(normalizeModelId(''), null);
});

test('resolveRate returns the fast tier only when the model has one', () => {
  assert.deepEqual(resolveRate('claude-opus-5', 'fast', PRICING), {
    input: 10, output: 50, key: 'claude-opus-5', tier: 'fast',
  });
  assert.equal(resolveRate('claude-opus-4-7', 'fast', PRICING).tier, 'standard');
  assert.equal(resolveRate('claude-made-up-9', null, PRICING), null);
});

// --- pricing --------------------------------------------------------------

test('priceRecord applies the published cache multipliers', () => {
  const cost = priceRecord(
    {
      model: 'claude-opus-5',
      inputTokens: 1_000_000,
      cacheWrite5mTokens: 1_000_000,
      cacheWrite1hTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      outputTokens: 1_000_000,
      webSearchRequests: 0,
    },
    PRICING,
  );
  assert.equal(cost.input, 5);
  assert.equal(cost.cacheWrite5m, 6.25);
  assert.equal(cost.cacheWrite1h, 10);
  assert.equal(cost.cacheRead, 0.5);
  assert.equal(cost.output, 25);
  assert.equal(cost.total, 46.75);
});

test('priceRecord bills web search per 1,000 searches', () => {
  const cost = priceRecord(
    {
      model: 'claude-haiku-4-5',
      inputTokens: 0, cacheWrite5mTokens: 0, cacheWrite1hTokens: 0,
      cacheReadTokens: 0, outputTokens: 0, webSearchRequests: 50,
    },
    PRICING,
  );
  assert.equal(cost.webSearch, 0.5);
  assert.equal(cost.total, 0.5);
});

test('priceRecord applies the US inference-geo multiplier to tokens only', () => {
  const base = {
    model: 'claude-opus-5', inputTokens: 1_000_000, cacheWrite5mTokens: 0,
    cacheWrite1hTokens: 0, cacheReadTokens: 0, outputTokens: 0, webSearchRequests: 1000,
  };
  const global = priceRecord(base, PRICING);
  const us = priceRecord({ ...base, inferenceGeo: 'us' }, PRICING);
  assert.equal(global.input, 5);
  assert.equal(us.input, 5.5);
  assert.equal(us.webSearch, global.webSearch);
});

test('an unpriced model is flagged, not silently zero-costed', () => {
  const cost = priceRecord(
    {
      model: 'claude-future-9', inputTokens: 1_000_000, cacheWrite5mTokens: 0,
      cacheWrite1hTokens: 0, cacheReadTokens: 0, outputTokens: 1_000_000, webSearchRequests: 0,
    },
    PRICING,
  );
  assert.equal(cost.unpriced, true);
  assert.equal(cost.total, 0);
});

// --- extraction -----------------------------------------------------------

test('extractRecord reads usage, model and attribution', () => {
  const record = extractRecord(JSON.parse(assistantEntry()), CONTEXT);
  assert.equal(record.id, 'msg_1');
  assert.equal(record.model, 'claude-opus-4-8');
  assert.equal(record.inputTokens, 100);
  assert.equal(record.outputTokens, 200);
  assert.equal(record.cacheWrite5mTokens, 1000);
  assert.equal(record.cacheWrite1hTokens, 0);
  assert.equal(record.cacheReadTokens, 10000);
  assert.equal(record.branch, 'hotfix/apply-refresh-2026-08');
  assert.equal(record.agent, 'orchestrator (main session)');
});

test('extractRecord ignores entries that are not billable assistant turns', () => {
  assert.equal(extractRecord({ type: 'user', message: { role: 'user' } }, CONTEXT), null);
  assert.equal(extractRecord({ type: 'assistant', message: {} }, CONTEXT), null);
  assert.equal(extractRecord(null, CONTEXT), null);
});

test('extractRecord attributes an untagged cache write to the cheaper 5m tier', () => {
  const entry = JSON.parse(assistantEntry({}, { cache_creation: undefined }));
  delete entry.message.usage.cache_creation;
  const record = extractRecord(entry, CONTEXT);
  assert.equal(record.cacheWrite5mTokens, 1000);
  assert.equal(record.cacheWrite1hTokens, 0);
});

test('extractRecord splits 1h cache writes out when the transcript reports them', () => {
  const record = extractRecord(
    JSON.parse(assistantEntry({}, {
      cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 12909 },
    })),
    CONTEXT,
  );
  assert.equal(record.cacheWrite1hTokens, 12909);
  assert.equal(record.cacheWrite5mTokens, 0);
});

test('collectFromTranscript skips blank and malformed lines', () => {
  const text = [assistantEntry(), '', 'not json', '{"type":"user"}'].join('\n');
  assert.equal(collectFromTranscript(text, CONTEXT).length, 1);
});

// --- deduplication --------------------------------------------------------

test('dedupe keeps one record per request, with the completed output count', () => {
  const partials = [
    { agent: 'a', id: 'msg_1', outputTokens: 2, inputTokens: 8 },
    { agent: 'a', id: 'msg_1', outputTokens: 2, inputTokens: 8 },
    { agent: 'a', id: 'msg_1', outputTokens: 267, inputTokens: 8 },
    { agent: 'a', id: 'msg_2', outputTokens: 10, inputTokens: 8 },
  ];
  const kept = dedupe(partials);
  assert.equal(kept.length, 2);
  assert.equal(kept.find((r) => r.id === 'msg_1').outputTokens, 267);
});

test('dedupe does not merge the same message id across different agents', () => {
  const kept = dedupe([
    { agent: 'orchestrator', id: 'msg_1', outputTokens: 5 },
    { agent: 'researcher', id: 'msg_1', outputTokens: 7 },
  ]);
  assert.equal(kept.length, 2);
});

// --- commands -------------------------------------------------------------

test('collectCommands finds slash commands and skill invocations', () => {
  const text = [
    '{"type":"user","message":{"role":"user","content":"<command-name>/refresh</command-name>"}}',
    '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"<command-name>hotfix</command-name>"}]}}',
    '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"feature"}}]}}',
  ].join('\n');
  assert.deepEqual(collectCommands(text), ['/feature', '/hotfix', '/refresh']);
});

test('collectCommands does not credit a command that is merely quoted', () => {
  // The transcript of writing this very file contains the literal string
  // "<command-name>/refresh</command-name>". A raw-text scan reported /refresh
  // as having run in a session that never invoked it.
  const text = [
    '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Write","input":{"file_path":"a.md","content":"see <command-name>/refresh</command-name>"}}]}}',
    '{"type":"assistant","message":{"content":[{"type":"text","text":"Next step is /refresh, but I have not run it."}]}}',
    '{"type":"user","toolUseResult":{"stdout":"<command-name>/hotfix</command-name>"}}',
  ].join('\n');
  assert.deepEqual(collectCommands(text), []);
});

test('collectCommands ignores a Skill call with no skill name', () => {
  const text = '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{}}]}}';
  assert.deepEqual(collectCommands(text), []);
});

// --- attribution ----------------------------------------------------------

test('classifyWorkflow maps branch prefixes to pipeline lines', () => {
  assert.equal(classifyWorkflow('feature/cost-control'), 'feature line');
  assert.equal(classifyWorkflow('hotfix/apply-refresh-2026-08'), 'hotfix line');
  assert.equal(classifyWorkflow('refresh/2026-08'), 'refresh line');
  assert.equal(classifyWorkflow('docs/agentic-workflow-diagram'), 'docs branches');
  assert.equal(classifyWorkflow('main'), 'main (direct)');
  assert.equal(classifyWorkflow(null), 'unattributed');
});

test('monthOf takes the calendar month from the timestamp', () => {
  assert.equal(monthOf('2026-08-11T15:46:12.237Z'), '2026-08');
  assert.equal(monthOf(null), 'unknown');
});

// --- aggregation ----------------------------------------------------------

test('aggregate rolls the same spend up along every axis', () => {
  const records = [
    ...collectFromTranscript(assistantEntry(), CONTEXT),
    ...collectFromTranscript(
      assistantEntry(
        { sessionId: 'sess-1', gitBranch: 'refresh/2026-08', message: { id: 'msg_2' } },
      ),
      { agent: 'researcher', sessionId: 'sess-1' },
    ),
  ];
  const agg = aggregate(records, PRICING);

  assert.equal(agg.totals.requests, 2);
  const month = agg.months.get('2026-08');
  const sumOf = (map) => [...map.values()].reduce((acc, b) => acc + b.usd, 0);
  for (const axis of [agg.agentsByMonth, agg.workflowsByMonth, agg.modelsByMonth]) {
    assert.ok(Math.abs(sumOf(axis.get('2026-08')) - month.usd) < 1e-12);
  }
  assert.deepEqual([...agg.agentsByMonth.get('2026-08').keys()].sort(), [
    'orchestrator (main session)',
    'researcher',
  ]);
  assert.deepEqual([...agg.workflowsByMonth.get('2026-08').keys()].sort(), [
    'hotfix line',
    'refresh line',
  ]);
  const session = agg.sessions.get('sess-1');
  assert.equal(session.requests, 2);
  assert.equal(session.agents.size, 2);
});

test('aggregate reports unpriced models instead of hiding them', () => {
  const agg = aggregate(
    collectFromTranscript(assistantEntry({ message: { model: 'claude-future-9' } }), CONTEXT),
    PRICING,
  );
  assert.deepEqual([...agg.unpricedModels], ['claude-future-9']);
  assert.equal(agg.totals.unpricedRequests, 1);
  assert.equal(agg.totals.usd, 0);
  assert.equal(agg.totals.requests, 1);
});

// --- manual entries -------------------------------------------------------

test('recordsFromManual prices a hand-recorded CI run like any other request', () => {
  const [record] = recordsFromManual([
    {
      date: '2026-08-01',
      agent: 'refresh-research (CI)',
      branch: 'refresh/2026-08',
      model: 'claude-opus-5',
      input_tokens: 1_000_000,
      output_tokens: 0,
      web_search_requests: 100,
    },
  ]);
  assert.equal(monthOf(record.timestamp), '2026-08');
  assert.equal(classifyWorkflow(record.branch), 'refresh line');
  assert.equal(priceRecord(record, PRICING).total, 5 + 1);
});

// --- the shrink guard -----------------------------------------------------

const LEDGER = [
  '# Cost Control',
  '',
  '## Totals to date',
  '',
  '| Metric | Value |',
  '| --- | --- |',
  '| Cost (list price) | **$103.92** |',
  '| API requests | 727 |',
  '| Output tokens | 747,915 |',
  '| Sessions | 5 |',
  '',
].join('\n');

test('recordedTotals reads the counts a rendered ledger reports', () => {
  assert.deepEqual(recordedTotals(LEDGER), { requests: 727, sessions: 5 });
});

test('recordedTotals strips the thousands separators num() writes', () => {
  const big = LEDGER.replace('| API requests | 727 |', '| API requests | 1,234,567 |');
  assert.equal(recordedTotals(big).requests, 1234567);
});

test('recordedTotals returns null when a figure is missing, never zero', () => {
  assert.equal(recordedTotals('# Cost Control\n\nnothing here\n'), null);
  assert.equal(recordedTotals(LEDGER.replace('| Sessions | 5 |', '')), null);
});

test('shrinkRefusal allows the first write, when there is nothing to lose', () => {
  assert.equal(shrinkRefusal(null, { requests: 3, sessions: 1 }), null);
});

test('shrinkRefusal allows a run that grows the ledger', () => {
  const previous = { requests: 727, sessions: 5 };
  assert.equal(shrinkRefusal(previous, { requests: 800, sessions: 6 }), null);
  assert.equal(shrinkRefusal(previous, { requests: 727, sessions: 5 }), null);
});

test('shrinkRefusal refuses the ephemeral-container overwrite that started this', () => {
  // The real numbers from the session that clobbered the ledger four times.
  const refusal = shrinkRefusal({ requests: 727, sessions: 5 }, { requests: 100, sessions: 1 });
  assert.match(refusal, /requests 727 -> 100/);
  assert.match(refusal, /sessions 5 -> 1/);
});

test('shrinkRefusal catches a session-count drop even when requests grow', () => {
  // One busy container can out-request the whole history and still be blind to it.
  const refusal = shrinkRefusal({ requests: 727, sessions: 5 }, { requests: 900, sessions: 1 });
  assert.match(refusal, /sessions 5 -> 1/);
  assert.doesNotMatch(refusal, /requests/);
});
