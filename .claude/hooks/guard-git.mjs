#!/usr/bin/env node
// PreToolUse guard for Bash: nothing an agent runs may reach main, a tag,
// a release, or the hooks that enforce that. See ADR-014.
// Exit 2 + one line on stderr blocks the tool call; exit 0 allows it.

const BRANCH = /^(feature|hotfix|refresh|docs)\/[A-Za-z0-9._-]+$/;
const PUSH_FLAGS = new Set(['--dry-run', '-u', '--set-upstream']);
// `git tag` with only these (or nothing) lists tags; anything else may create one.
const TAG_LIST_FLAGS = /^(-l|--list|-n\d*|--contains|--no-contains|--points-at|--merged|--no-merged|--sort=.*|--format=.*|--omit-empty|--color.*|--ignore-case|-i)$/;

function block(reason) {
  process.stderr.write(`Blocked by guard-git: ${reason}\n`);
  process.exit(2);
}

// Leading words that only decorate the command that follows them. Some take
// arguments of their own (`timeout 5 …`, `nice -n 5 …`, `sudo -u x …`), which
// have to be dropped too or the wrapped command stays hidden.
const WRAPPERS = new Map([
  ['env', { valueFlags: ['-u', '--unset'] }],
  ['command', {}],
  ['nohup', {}],
  ['time', {}],
  ['stdbuf', { valueFlags: ['-i', '-o', '-e', '--input', '--output', '--error'] }],
  ['setsid', {}],
  ['sudo', { valueFlags: ['-u', '--user', '-g', '--group', '-p', '--prompt', '-U', '-C', '-r', '--role', '-t', '--type', '-T'] }],
  ['timeout', { valueFlags: ['-s', '--signal', '-k', '--kill-after'], duration: true }],
  ['nice', { valueFlags: ['-n', '--adjustment'] }],
]);
const DURATION = /^\d+(\.\d+)?[smhd]?$/;

// Split a compound command into the simple commands it runs. `&&` has to be
// tried before a lone `&`, which is a separator too (`true & git push`).
function segments(command) {
  return command
    .split(/\|\||&&|[;\n|&]/)
    .map((s) => s.replace(/^[\s(){]+/, '').trim())
    .filter(Boolean);
}

function tokens(segment) {
  return segment
    .split(/\s+/)
    .map((t) => t.replace(/[)}]+$/, '')) // `(git push)` — the paren sticks to the token
    .filter(Boolean)
    .filter((t) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)); // drop env assignments
}

// `env git push`, `\git push`, `stdbuf -o0 git push`, `timeout 5 git push`,
// `sudo -u x git push`, `nice -n 5 git push` all run git.
function unwrap(words) {
  let rest = words.slice();
  while (rest.length) {
    rest[0] = rest[0].replace(/^\\/, '');
    const spec = WRAPPERS.get(rest[0].replace(/^.*\//, ''));
    if (!spec) break;
    rest = rest.slice(1);
    while (rest.length && rest[0].startsWith('-')) {
      const flag = rest[0];
      rest = rest.slice(1);
      // `-s KILL` eats its value; `-s=KILL` and `-o0` carry it already.
      if (rest.length && (spec.valueFlags || []).includes(flag)) rest = rest.slice(1);
    }
    // `timeout [flags] <duration> <command>`
    if (spec.duration && rest.length > 1 && DURATION.test(rest[0])) rest = rest.slice(1);
  }
  return rest;
}

// Strip git's global options so we can see the subcommand.
function gitArgs(words) {
  const rest = words.slice(1);
  while (rest.length) {
    const w = rest[0];
    if (w === '-C' || w === '-c') rest.splice(0, 2);
    else if (w.startsWith('--') || w.startsWith('-')) rest.shift();
    else break;
  }
  return rest;
}

function checkPush(args) {
  const flags = args.filter((a) => a.startsWith('-'));
  const positional = args.filter((a) => !a.startsWith('-'));
  for (const f of flags) {
    if (!PUSH_FLAGS.has(f)) block(`\`git push ${f}\` is not allowed.`);
  }
  if (positional.length !== 2) {
    block('only `git push [--dry-run] [-u] origin <branch>` is allowed; main is merged by Markus.');
  }
  const [remote, branch] = positional;
  if (remote !== 'origin') block(`pushing to remote "${remote}" is not allowed.`);
  if (!BRANCH.test(branch)) {
    block(`refusing to push "${branch}" — only feature/, hotfix/, refresh/ and docs/ branches.`);
  }
}

const HOOKS_PATH = /^core\.hooksPath$/i;
const CONFIG_WRITE_FLAGS = new Set(['--unset', '--unset-all', '--replace-all', '--add', '--edit']);

// `git config` only changes the setting when it is given a value or an
// explicit write flag; `--get core.hooksPath` just reads it.
function checkConfig(rest) {
  const key = rest.findIndex((a) => HOOKS_PATH.test(a));
  if (key === -1) return;
  const writeFlag = rest.some((a) => CONFIG_WRITE_FLAGS.has(a));
  const value = rest.slice(key + 1).some((a) => !a.startsWith('-'));
  if (writeFlag || value) {
    block('changing core.hooksPath would disable the push protection.');
  }
}

function checkGit(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (sub === 'push') return checkPush(rest);
  if (sub === 'config') checkConfig(rest);
  if (sub === 'commit' && rest.includes('--no-verify')) {
    block('`git commit --no-verify` skips the hooks that protect main.');
  }
  if (sub === 'tag') {
    const bad = rest.find((a) => !TAG_LIST_FLAGS.test(a) && a.startsWith('-'));
    if (bad) block(`\`git tag ${bad}\` may create or delete a tag — releases are tagged by Markus.`);
    const listing = rest.some((a) => a === '-l' || a === '--list');
    const names = rest.filter((a) => !a.startsWith('-'));
    if (names.length && !listing) block('`git tag <name>` creates a tag — releases are tagged by Markus.');
  }
}

const unquote = (t) => t.replace(/^["']|["']$/g, '');

// `.git/config`, `~/.gitconfig`, `.gitconfig`, or any `…/config` inside `.git`.
function isGitConfigFile(token) {
  const p = unquote(token);
  return (
    /(^|\/)\.gitconfig$/.test(p) ||
    /(^|\/)\.git\/config$/.test(p) ||
    /(^|\/)\.git\/.*\/config$/.test(p)
  );
}

function redirectTargets(segment) {
  return [...segment.matchAll(/>>?\s*\|?\s*(["']?[^\s;|&<>]+)/g)].map((m) => m[1]);
}

function checkSegment(segment) {
  const words = unwrap(tokens(segment));
  if (!words.length) return;
  const cmd = words[0].replace(/^.*\//, '');

  if (cmd === 'git') {
    // `git -c core.hooksPath=… <anything>` sets it for that one command. Only
    // as git's own `-c` argument — the same text inside `-m "…"` is a message.
    const isHooksPathArg = (w, i) => {
      const t = unquote(w);
      if (/^-c\s*core\.hooksPath=/i.test(t)) return true;
      return /^core\.hooksPath=/i.test(t) && unquote(words[i - 1] || '') === '-c';
    };
    if (words.some(isHooksPathArg)) {
      block('changing core.hooksPath would disable the push protection.');
    }
    checkGit(gitArgs(words));
  }

  if (cmd === 'gh') {
    const args = words.slice(1).filter((a) => !a.startsWith('-'));
    if (args[0] === 'pr' && args[1] === 'merge') block('`gh pr merge` — only Markus merges.');
    if (args[0] === 'release' && args[1] === 'create') block('`gh release create` — only Markus releases.');
  }

  // Outside git, only commands that could actually write the setting — a
  // mention of it in a commit message, a log grep or an echo into notes is
  // not a change. A redirect counts when it lands in a git config file; an
  // editing command counts when it rewrites one, or spells out the key.
  if (cmd !== 'git') {
    const editor = /^(sed|perl|awk|tee|python3?|node)$/.test(cmd);
    const intoConfig =
      redirectTargets(segment).some(isGitConfigFile) ||
      (editor && words.slice(1).some(isGitConfigFile));
    if ((intoConfig && /hooksPath/i.test(segment)) || (editor && /core\.hooksPath/i.test(segment))) {
      block('changing core.hooksPath would disable the push protection.');
    }
  }

  if (/^(rm|mv|cp|ln|truncate|shred|unlink|chmod|chown)$/.test(cmd) && /\.git\/hooks|\.githooks/.test(segment)) {
    block('refusing to delete, move, overwrite or disarm the git hooks.');
  }
  if (/>\s*["']?\S*(\.git\/hooks|\.githooks)/.test(segment)) {
    block('refusing to overwrite a file under the git hooks directory.');
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  // Failing open is deliberate, but never silent: layers 1 and 2 still hold.
  function allowUnparsed(why) {
    process.stderr.write(`guard-git: ${why} — allowing without inspection\n`);
    process.exit(0);
  }

  let command;
  try {
    command = JSON.parse(input || '{}')?.tool_input?.command;
  } catch {
    allowUnparsed('could not parse the hook input as JSON');
  }
  if (typeof command !== 'string') allowUnparsed('no tool_input.command string in the hook input');
  for (const segment of segments(command)) checkSegment(segment);
  process.exit(0);
});
