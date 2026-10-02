import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GUARD = fileURLToPath(new URL('../.claude/hooks/guard-git.mjs', import.meta.url));

function run(command) {
  const payload = JSON.stringify({
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command },
  });
  const r = spawnSync(process.execPath, [GUARD], { input: payload, encoding: 'utf8' });
  return { status: r.status, stderr: r.stderr };
}

const BLOCKED = [
  'git push',
  'git push origin main',
  'git push origin HEAD:main',
  'git push -f origin hotfix/x',
  'git push --no-verify -u origin hotfix/x',
  'cd x && git push',
  'git -C . push origin main',
  'git push --force-with-lease origin hotfix/x',
  'git push --tags origin hotfix/x',
  'git push --delete origin hotfix/x',
  'git push upstream hotfix/x',
  'git commit --no-verify -m "x"',
  'gh pr merge 12',
  'gh release create v1',
  'git tag v1',
  'git config core.hooksPath /dev/null',
  'git config --unset core.hooksPath',
  'rm .git/hooks/pre-push',
  'mv .githooks/pre-push /tmp/x',
  'echo nope > .githooks/pre-push',
];

const ALLOWED = [
  'git push -u origin hotfix/x',
  'git push origin feature/a-b',
  'git push --set-upstream origin docs/adr-014',
  'git push --dry-run origin refresh/2026-10',
  'git status',
  'git tag -l',
  'git tag',
  'git commit -m "fix: guard"',
  'gh pr create --base main --head hotfix/x',
  'npm run verify',
  'echo "git push is blocked"',
  'echo "enable it with core.hooksPath"',
  'node --test scripts/guard-git.test.mjs',
];

for (const command of BLOCKED) {
  test(`blocks: ${command}`, () => {
    const { status, stderr } = run(command);
    assert.equal(status, 2, `expected exit 2, got ${status}`);
    assert.match(stderr, /Blocked by guard-git/);
  });
}

for (const command of ALLOWED) {
  test(`allows: ${command}`, () => {
    const { status, stderr } = run(command);
    assert.equal(status, 0, `expected exit 0, got ${status}: ${stderr}`);
  });
}

test('ignores input that is not a Bash command payload', () => {
  const r = spawnSync(process.execPath, [GUARD], { input: 'not json', encoding: 'utf8' });
  assert.equal(r.status, 0);
});
