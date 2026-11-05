// Regression tests for the main-session Bash tripwire (.claude/hooks/guard-bash.cjs).
// These test the HOOK ONLY, with synthetic hook input. No command under test is executed;
// the only real git commands are `git init`/`symbolic-ref` on throwaway temp repos so the
// hook can resolve the current branch. They are not application tests: run them with
// `pnpm run test:agent-hooks`; application tests remain `pnpm run test` and friends.
//
// The guard is best effort. The "known gaps" block below records forms it does NOT catch,
// so that a change in coverage is a visible, deliberate test change rather than a surprise.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const HOOK = path.join(__dirname, '..', 'guard-bash.cjs');
const { evaluate } = require(HOOK);

function tempRepo(branch) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-guard-'));
  execFileSync('git', ['init', '-q', '-b', branch, dir]);
  return dir;
}
const onMain = tempRepo('main');
const onFeature = tempRepo('agent-ops/example');
const notARepo = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-guard-norepo-'));

test.after(() => {
  for (const d of [onMain, onFeature, notARepo]) fs.rmSync(d, { recursive: true, force: true });
});

const decide = (command, cwd = onFeature) => evaluate(command, cwd).decision;

function table(name, cwd, rows) {
  test(name, () => {
    for (const [command, expected] of rows) {
      assert.equal(decide(command, cwd), expected, `${expected.toUpperCase()} expected for: ${command}`);
    }
  });
}

// Cases reported by the independent Codex review of the first patch (2026-11-05).
table('Codex review cases', onMain, [
  ['git push origin main', 'deny'],
  ['git push origin HEAD:refs/heads/main', 'deny'],
  ['npm exec -- prisma migrate deploy', 'ask'], // was a hard block; now escalates (disposable DBs use it)
  ['vercel --prod', 'deny'],
  ['git push', 'deny'], // was ALLOWED: bare push while on main
  ['git -C /tmp/example push origin main', 'deny'], // was ALLOWED: git global option before push
  ['cat .env.example', 'allow'], // was BLOCKED: template file is safe
]);

table('pushes to protected branches are denied in any form', onFeature, [
  ['git push origin main', 'deny'],
  ['git push origin master', 'deny'],
  ['git push origin feature:main', 'deny'],
  ['git push origin HEAD:main', 'deny'],
  ['git push upstream refs/heads/main', 'deny'],
  ["git 'push' origin main", 'deny'],
  ['git -c push.default=current push origin main', 'deny'],
  ['git --git-dir=.git push origin main', 'deny'],
  ['/usr/bin/git push origin main', 'deny'],
  ['GIT_TRACE=1 git push origin main', 'deny'],
  ['timeout 60 git push origin main', 'deny'],
  ["bash -c 'git push origin main'", 'deny'],
  ['sh -c "cd . && git push origin main"', 'deny'],
  ['eval git push origin main', 'deny'],
  ['echo $(git push origin main)', 'deny'],
  ['pnpm run lint && git push origin main', 'deny'],
  ['true; git push origin main', 'deny'],
  ['git push --all origin', 'deny'],
  ['git push --mirror origin', 'deny'],
]);

table('force pushes are denied', onFeature, [
  ['git push --force origin agent-ops/example', 'deny'],
  ['git push -f origin agent-ops/example', 'deny'],
  ['git push --force-with-lease origin agent-ops/example', 'deny'],
  ['git push origin +agent-ops/example', 'deny'],
  ['git push -uf origin agent-ops/example', 'deny'],
]);

table('bare and HEAD pushes resolve the current branch', onMain, [
  ['git push', 'deny'],
  ['git push origin', 'deny'],
  ['git push origin HEAD', 'deny'],
]);
table('bare and HEAD pushes from a feature branch', onFeature, [
  ['git push', 'ask'], // destination depends on push.default/upstream
  ['git push origin', 'ask'],
  ['git push origin HEAD', 'allow'],
  ['git push -u origin agent-ops/example', 'allow'],
]);
table('push with unknown branch fails closed', notARepo, [
  ['git push', 'deny'],
]);
test('git -C resolves the branch of the named directory', () => {
  assert.equal(decide(`git -C ${onMain} push`, onFeature), 'deny');
  assert.equal(decide(`git -C ${onFeature} push origin HEAD`, onMain), 'allow');
});

table('tracking origin/main is denied (Nov 4 auto-push incident)', onFeature, [
  ['git branch --set-upstream-to=origin/main', 'deny'],
  ['git branch -u origin/main', 'deny'],
  ['git switch --track -c work origin/main', 'deny'],
  ['git checkout -t origin/main', 'deny'],
  ['git switch --no-track -c agent-ops/x origin/main', 'allow'],
]);

table('production deploys are denied; other hosting writes ask', onFeature, [
  ['vercel --prod', 'deny'],
  ['vercel deploy --prod', 'deny'],
  ['npx vercel --prod', 'deny'],
  ['pnpm dlx vercel promote dpl_123', 'deny'],
  ['vercel rollback', 'deny'],
  ['vercel deploy --target=production', 'deny'],
  ['vercel', 'ask'],
  ['vercel deploy', 'ask'],
  ['vercel env pull', 'ask'],
  ['vercel ls', 'allow'],
]);

table('migrations and database tools escalate; disposable docker psql is allowed', onFeature, [
  ['prisma migrate deploy', 'ask'],
  ['pnpm prisma migrate deploy', 'ask'],
  ['npx prisma migrate reset --force', 'ask'],
  ['prisma db push', 'ask'],
  ['pnpm run db:deploy', 'ask'],
  ['npm run db:deploy', 'ask'],
  ['prisma migrate status', 'allow'],
  ['prisma generate', 'allow'],
  ['supabase db reset', 'ask'],
  ['supabase link --project-ref abc', 'ask'],
  ['supabase start', 'allow'],
  ['docker exec -i oc-test psql -U fixture_superuser -d outclass_test -v ON_ERROR_STOP=1', 'allow'],
  ['psql postgres://u@localhost:5432/test', 'allow'],
  ['psql "$REMOTE_URL"', 'ask'],
  ['pg_dump postgres://u@db.example.com/x', 'ask'],
]);

table('the production project ref', onFeature, [
  ['psql postgres://x@db.htlgjluegmdwfjkzzwic.supabase.co:5432/postgres', 'deny'],
  ['DATABASE_URL=postgres://db.htlgjluegmdwfjkzzwic.supabase.co pnpm prisma migrate deploy', 'deny'],
  ['claude mcp add --scope local --transport http supabase "https://mcp.supabase.com/mcp?project_ref=htlgjluegmdwfjkzzwic&read_only=true"', 'ask'],
]);

table('secrets', onFeature, [
  ['printenv', 'deny'],
  ['env', 'deny'],
  ['env | grep KEY', 'deny'],
  ['export -p', 'deny'],
  ['cat .env', 'deny'],
  ['cat .env.local', 'deny'],
  ['head -5 ./.env.production', 'deny'],
  ['grep DATABASE .env', 'deny'],
  ['source .env.local', 'deny'],
  ['echo $DATABASE_URL', 'deny'],
  ['printf "%s" "${SUPABASE_SERVICE_ROLE_KEY}"', 'deny'],
  ['cat .env.example', 'allow'],
  ['diff .env.example .env.example', 'allow'],
  ['env NODE_ENV=test node --test tests/a.test.cjs', 'allow'],
  ['grep -c NEXT_PUBLIC .env.example', 'allow'],
]);

table('ordinary development work is not blocked', onFeature, [
  ['pnpm run test', 'allow'],
  ['pnpm run test:migrations', 'allow'],
  ['pnpm run typecheck && pnpm run lint', 'allow'],
  ['node --test tests/voting-session.test.cjs', 'allow'],
  ['node scripts/run-disposable-postgres.cjs', 'allow'],
  ['git status --short', 'allow'],
  ['git log -8 --oneline', 'allow'],
  ['git diff origin/main...HEAD --stat', 'allow'],
  ['git commit -m "Fix main navigation"', 'allow'],
  ['git switch -c fix/main-nav', 'allow'],
  ['echo "push to main is blocked"', 'allow'],
  ['grep -rn "git push origin main" docs', 'allow'],
  ['pnpm run build', 'allow'],
]);

table('history-destroying local git commands escalate', onFeature, [
  ['git reset --hard origin/main', 'ask'],
  ['git clean -fdx', 'ask'],
  ['git reset --soft HEAD~1', 'allow'],
]);

// KNOWN GAPS: forms the tripwire does not catch. These assertions document the limits;
// if one starts failing because coverage improved, move the case into a table above.
test('known gaps (documented, not caught by the text tripwire)', () => {
  const gaps = [
    // runtime expansion: the destination is not in the text
    'B=main; git push origin $B',
    // code that runs git from inside another program
    "node -e \"require('child_process').execSync('git push origin main')\"",
    "python3 -c \"import os; os.system('git push origin main')\"",
    // a package script or Makefile target that pushes or deploys internally
    'pnpm run release',
    // a git alias defined in config
    'git publish',
  ];
  for (const command of gaps) assert.equal(decide(command, onFeature), 'allow', `gap changed: ${command}`);
});

// ---------- process contract ----------

function runHook(stdin, cwd = onFeature) {
  return spawnSync(process.execPath, [HOOK], { input: stdin, cwd, encoding: 'utf8' });
}
const input = (command, cwd = onFeature) => JSON.stringify({
  hook_event_name: 'PreToolUse', tool_name: 'Bash', cwd, tool_input: { command },
});

test('deny exits 2 with a reason on stderr and no stdout', () => {
  const r = runHook(input('git push origin main'));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Blocked by \.claude\/hooks\/guard-bash\.cjs/);
  assert.match(r.stderr, /tripwire, not a permission/);
  assert.equal(r.stdout, '');
});

test('ask exits 0 with a PreToolUse permissionDecision "ask"', () => {
  const r = runHook(input('prisma migrate deploy'));
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(out.hookSpecificOutput.permissionDecision, 'ask');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /DATABASE_URL/);
});

test('allow exits 0 with no output, leaving normal permission rules in charge', () => {
  const r = runHook(input('pnpm run test'));
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('hook uses the cwd from its input to resolve the branch', () => {
  assert.equal(runHook(input('git push', onMain), onFeature).status, 2);
});

test('unparseable input fails closed', () => {
  const r = runHook('not json');
  assert.equal(r.status, 2);
});


test('Git repository selectors determine HEAD independently of the session repo', () => {
  for (const selector of [`--git-dir=${onMain}/.git`, `--git-dir ${onMain}/.git`]) {
    assert.equal(decide(`git ${selector} push origin HEAD`, onFeature), 'deny');
    assert.equal(decide(`git ${selector} push`, onFeature), 'deny');
  }
  assert.equal(decide(`git --git-dir=${onFeature}/.git push origin HEAD`, onMain), 'allow');
  assert.equal(decide(`git -C ${onMain} --git-dir=.git push origin HEAD`, onFeature), 'deny');
  assert.equal(decide(`git --git-dir=${notARepo}/missing push origin HEAD`, onFeature), 'deny');
});

test('unrelated Docker commands never exempt sibling database clients', () => {
  for (const separator of [' && ', '; ', ' | ', '\n']) {
    assert.equal(decide('docker exec oc-test true' + separator + 'pg_restore --dbname="$REMOTE_URL" dump.sql'), 'ask');
    assert.equal(decide('psql -h remote.example -c "SELECT 1"' + separator + 'docker compose exec db true'), 'ask');
  }
  assert.equal(decide('echo "docker exec oc-test true" && pg_dump -h remote.example app'), 'ask');
});
