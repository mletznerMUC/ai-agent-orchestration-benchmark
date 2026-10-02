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

// Split a compound command into the simple commands it runs.
function segments(command) {
  return command
    .split(/\|\||&&|[;\n|]/)
    .map((s) => s.replace(/^[\s(){]+/, '').trim())
    .filter(Boolean);
}

function tokens(segment) {
  return segment
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)); // drop leading env assignments
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

function checkGit(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (sub === 'push') return checkPush(rest);
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

function checkSegment(segment) {
  const words = tokens(segment);
  if (!words.length) return;
  const cmd = words[0].replace(/^.*\//, '');

  if (cmd === 'git') checkGit(gitArgs(words));

  if (cmd === 'gh') {
    const args = words.slice(1).filter((a) => !a.startsWith('-'));
    if (args[0] === 'pr' && args[1] === 'merge') block('`gh pr merge` — only Markus merges.');
    if (args[0] === 'release' && args[1] === 'create') block('`gh release create` — only Markus releases.');
  }

  // Only commands that could actually write the setting — a mention of it in
  // a commit message or an echo is not a change.
  const writer = /^(git|sed|perl|awk|tee|python3?|node)$/.test(cmd) || />/.test(segment);
  if (writer && /core\.hooksPath/i.test(segment)) {
    block('changing core.hooksPath would disable the push protection.');
  }

  if (/^(rm|mv|cp|ln|truncate|shred|unlink)$/.test(cmd) && /\.git\/hooks|\.githooks/.test(segment)) {
    block('refusing to delete, move or overwrite the git hooks.');
  }
  if (/>\s*["']?\S*(\.git\/hooks|\.githooks)/.test(segment)) {
    block('refusing to overwrite a file under the git hooks directory.');
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  let command = '';
  try {
    command = JSON.parse(input || '{}')?.tool_input?.command ?? '';
  } catch {
    process.exit(0); // not a shape we understand — not ours to block
  }
  if (typeof command !== 'string') process.exit(0);
  for (const segment of segments(command)) checkSegment(segment);
  process.exit(0);
});
