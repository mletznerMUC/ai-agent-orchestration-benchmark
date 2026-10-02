/**
 * Hands-on reproducer for docs/evaluations/vercel-ai-sdk.md.
 *
 * Decides one matrix criterion that the documentation did not settle:
 *   multi-agent-parallel — do two agent loops really interleave in one
 *   process, and can a parent agent delegate to a subagent?
 *
 * Runs fully offline against the AI SDK's own mock language model
 * (`MockLanguageModelV4` from `ai/test`). No provider account, no network
 * call, no credentials. The script reads no environment variable, prints no
 * environment variable and sends no HTTP request; there is no real-provider
 * mode to opt into.
 *
 * A mock model proves a mechanism, not model behaviour. What it can show is
 * that the SDK performs a multi-step tool loop, that two loops overlap in
 * wall-clock time, that a tool can run a second agent, and that an approval
 * policy pauses the loop. What it cannot show is anything that depends on a
 * real model's choices.
 *
 * Usage:  npm ci && node run.mjs
 * Format of the log this feeds: docs/decisions/012-hands-on-evidence.md
 */
import { ToolLoopAgent, tool, isStepCount } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { z } from 'zod';

const SDK_VERSION = '7.0.127';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One shared, ordered event log. Interleaving is read off this, not inferred.
const events = [];
const started = Date.now();
const record = (who, what) => {
  events.push({ at: Date.now() - started, who, what });
};

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
};

/**
 * A mock model that calls `toolName` once per run and then answers with text.
 * `latencyMs` makes each "model call" take measurable time so two concurrent
 * loops have something to overlap in.
 */
function scriptedModel({ who, toolName, toolInput, latencyMs, finalText }) {
  let step = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => {
      const current = ++step;
      record(who, `model step ${current} started`);
      await sleep(latencyMs);
      record(who, `model step ${current} returned`);

      if (current === 1) {
        return {
          content: [
            {
              type: 'tool-call',
              toolCallId: `${who}-call-${current}`,
              toolName,
              input: JSON.stringify(toolInput),
            },
          ],
          finishReason: { unified: 'tool-calls', raw: undefined },
          usage,
          warnings: [],
        };
      }
      return {
        content: [{ type: 'text', text: finalText }],
        finishReason: { unified: 'stop', raw: undefined },
        usage,
        warnings: [],
      };
    },
  });
}

/** Observation A — two agent loops running at the same time. */
async function observationA() {
  const makeAgent = (who, latencyMs) =>
    new ToolLoopAgent({
      model: scriptedModel({
        who,
        toolName: 'work',
        toolInput: { item: who },
        latencyMs,
        finalText: `${who} finished`,
      }),
      tools: {
        work: tool({
          description: 'Do a unit of work.',
          inputSchema: z.object({ item: z.string() }),
          execute: async ({ item }) => {
            record(who, `tool "work" executing for ${item}`);
            await sleep(40);
            record(who, `tool "work" done for ${item}`);
            return { item, ok: true };
          },
        }),
      },
      stopWhen: isStepCount(4),
    });

  const agentA = makeAgent('agent-A', 60);
  const agentB = makeAgent('agent-B', 20);

  const [a, b] = await Promise.all([
    agentA.generate({ prompt: 'do the work' }),
    agentB.generate({ prompt: 'do the work' }),
  ]);

  return { aText: a.text, bText: b.text, aSteps: a.steps.length, bSteps: b.steps.length };
}

/** Observation B — a parent agent delegating to a subagent through a tool. */
async function observationB() {
  const subagent = new ToolLoopAgent({
    model: scriptedModel({
      who: 'subagent',
      toolName: 'lookup',
      toolInput: { topic: 'delegated topic' },
      latencyMs: 10,
      finalText: 'subagent summary: two facts found',
    }),
    tools: {
      lookup: tool({
        description: 'Look something up.',
        inputSchema: z.object({ topic: z.string() }),
        execute: async ({ topic }) => {
          record('subagent', `tool "lookup" executing for ${topic}`);
          return { topic, facts: 2 };
        },
      }),
    },
    stopWhen: isStepCount(4),
  });

  const parent = new ToolLoopAgent({
    model: scriptedModel({
      who: 'parent',
      toolName: 'research',
      toolInput: { task: 'research the topic' },
      latencyMs: 10,
      finalText: 'parent answer, built on the subagent result',
    }),
    tools: {
      research: tool({
        description: 'Delegate a research task to a subagent.',
        inputSchema: z.object({ task: z.string() }),
        execute: async ({ task }, { abortSignal }) => {
          record('parent', 'tool "research" delegating to subagent');
          const result = await subagent.generate({ prompt: task, abortSignal });
          record('parent', 'subagent returned to parent');
          return { summary: result.text };
        },
      }),
    },
    stopWhen: isStepCount(4),
  });

  const result = await parent.generate({ prompt: 'research the topic' });
  const toolResults = result.steps.flatMap((s) => s.toolResults ?? []);
  return { parentText: result.text, delegatedSummary: toolResults[0]?.output?.summary };
}

/** Observation C — an approval policy pausing the loop before a tool runs. */
async function observationC() {
  const agent = new ToolLoopAgent({
    model: scriptedModel({
      who: 'approval-agent',
      toolName: 'deleteFile',
      toolInput: { path: '/tmp/example.txt' },
      latencyMs: 5,
      finalText: 'should not be reached',
    }),
    tools: {
      deleteFile: tool({
        description: 'Delete a file.',
        inputSchema: z.object({ path: z.string() }),
        execute: async ({ path }) => {
          record('approval-agent', `tool "deleteFile" EXECUTED for ${path}`);
          return { deleted: path };
        },
      }),
    },
    toolApproval: { deleteFile: 'user-approval' },
    stopWhen: isStepCount(4),
  });

  const result = await agent.generate({ prompt: 'delete the file' });
  const requests = result.steps.flatMap((s) =>
    (s.content ?? []).filter((p) => p.type === 'tool-approval-request'),
  );
  const executed = events.some((e) => e.what.includes('EXECUTED'));
  return { approvalRequests: requests.length, toolExecuted: executed };
}

const line = (s = '') => console.log(s);

line(`AI SDK hands-on observation — package "ai" version ${SDK_VERSION}`);
line(`model: MockLanguageModelV4 from "ai/test" (offline, no credentials)`);
line(`node: ${process.version}`);
line();

line('— Observation A: two agent loops at the same time —');
const a = await observationA();
const windowOf = (who) => {
  const own = events.filter((e) => e.who === who);
  return [own[0].at, own[own.length - 1].at];
};
const [aStart, aEnd] = windowOf('agent-A');
const [bStart, bEnd] = windowOf('agent-B');
const overlaps = bStart < aEnd && aStart < bEnd;
for (const e of events) line(`  t+${String(e.at).padStart(4)}ms  ${e.who.padEnd(14)} ${e.what}`);
line(`  agent-A: ${a.aSteps} steps, final text "${a.aText}"`);
line(`  agent-B: ${a.bSteps} steps, final text "${a.bText}"`);
line(`  agent-A active t+${aStart}..${aEnd}ms, agent-B active t+${bStart}..${bEnd}ms`);
line(`  loops overlap in wall-clock time: ${overlaps}`);
line(`  agent-B steps recorded while agent-A was still running: ${countInterleaved()}`);
line();

function countInterleaved() {
  const aLast = events.filter((e) => e.who === 'agent-A').slice(-1)[0].at;
  const aFirst = events.filter((e) => e.who === 'agent-A')[0].at;
  return events.filter((e) => e.who === 'agent-B' && e.at >= aFirst && e.at <= aLast).length;
}

events.length = 0;
line('— Observation B: parent agent delegating to a subagent —');
const b = await observationB();
for (const e of events) line(`  t+${String(e.at).padStart(4)}ms  ${e.who.padEnd(14)} ${e.what}`);
line(`  subagent result handed back to the parent: "${b.delegatedSummary}"`);
line(`  parent final text: "${b.parentText}"`);
line();

events.length = 0;
line('— Observation C: approval policy pausing before a tool runs —');
const c = await observationC();
for (const e of events) line(`  t+${String(e.at).padStart(4)}ms  ${e.who.padEnd(14)} ${e.what}`);
line(`  tool-approval-request parts returned: ${c.approvalRequests}`);
line(`  tool executed without approval: ${c.toolExecuted}`);
line();
line('Observation A decides multi-agent-parallel. B and C corroborate cells');
line('that the documentation already settles (group-chat, hitl).');
