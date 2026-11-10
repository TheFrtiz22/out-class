// The disposable onboarding runner retries `supabase start` once and keeps each failed attempt's log.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');

const source = fs.readFileSync('scripts/run-onboarding-e2e.cjs', 'utf8');
const functions = ['keepStartLog', 'startSupabase'].map(name => source.match(new RegExp(`function ${name}\\(\\)?[^]*?\\n}\\n`))?.[0] ?? source.match(new RegExp(`function ${name}\\([^]*?\\n}\\n`))[0]).join('\n');

function harness(outcomes) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'outclass-start-retry-')), logs = fs.mkdtempSync(path.join(os.tmpdir(), 'outclass-start-logs-'));
  const calls = [];
  const logged = (binary, args, log) => {
    calls.push(args.join(' ').replace(/ --workdir \S+/, '').replace(/ -x \S+/, ''));
    if (args[0] !== 'start') return;
    const ok = outcomes.shift();
    fs.writeFileSync(path.join(root, log), ok ? 'Started supabase local development setup.' : 'failed to start docker container: port already allocated');
    if (!ok) throw Error('supabase failed');
  };
  const previous = process.env.OUTCLASS_E2E_LOG_DIR; process.env.OUTCLASS_E2E_LOG_DIR = logs;
  const messages = [];
  const startSupabase = new Function('fs', 'path', 'root', 'projectId', 'logged', 'console', `${functions}\nreturn startSupabase;`)(fs, path, root, 'outclass-onboarding-e2e', logged, { log: m => messages.push(m), warn: m => messages.push(m) });
  return { root, logs, calls, messages, startSupabase, restore() { if (previous === undefined) delete process.env.OUTCLASS_E2E_LOG_DIR; else process.env.OUTCLASS_E2E_LOG_DIR = previous } };
}

test('a failed supabase start is stopped, retried once, and its log kept for upload', () => {
  const h = harness([false, true]);
  try {
    assert.equal(h.startSupabase(), 2);
    assert.deepEqual(h.calls, ['start', 'stop --no-backup', 'start'], 'the half-started volume is discarded before the retry');
    assert.match(h.messages.join('\n'), /^::warning title=supabase start retried::First attempt failed \(supabase failed\)/m, 'a green run still shows the retry');
    assert.match(fs.readFileSync(path.join(h.root, 'supabase-start-attempt-1.log'), 'utf8'), /port already allocated/);
    assert.deepEqual(fs.readdirSync(h.logs), ['outclass-onboarding-e2e-supabase-start-attempt-1.log']);
  } finally { h.restore() }
});

test('a first-time start makes no retry and uploads nothing; two failures fail the run with both logs kept', () => {
  const ok = harness([true]);
  try { assert.equal(ok.startSupabase(), 1); assert.deepEqual(ok.calls, ['start']); assert.deepEqual(fs.readdirSync(ok.logs), []); } finally { ok.restore() }
  const bad = harness([false, false]);
  try {
    assert.throws(() => bad.startSupabase(), /supabase failed/);
    assert.deepEqual(bad.calls, ['start', 'stop --no-backup', 'start'], 'exactly one retry');
    assert.deepEqual(fs.readdirSync(bad.logs).sort(), ['outclass-onboarding-e2e-supabase-start-attempt-1.log', 'outclass-onboarding-e2e-supabase-start-attempt-2.log']);
  } finally { bad.restore() }
});

test('CI uploads the start logs from both onboarding-runner jobs', () => {
  const workflow = fs.readFileSync('.github/workflows/disposable-integrations.yml', 'utf8');
  assert.equal((workflow.match(/OUTCLASS_E2E_LOG_DIR: \$\{\{ runner\.temp \}\}\/supabase-start-logs/g) || []).length, 2);
  assert.equal((workflow.match(/path: \$\{\{ runner\.temp \}\}\/supabase-start-logs/g) || []).length, 2);
});

test('a log that cannot be kept warns instead of disappearing silently', () => {
  const h = harness([false, true]);
  try {
    fs.writeFileSync(path.join(h.logs, 'blocker'), ''); process.env.OUTCLASS_E2E_LOG_DIR = path.join(h.logs, 'blocker', 'nested');
    h.startSupabase();
    assert.ok(h.messages.some(m => /^Could not keep supabase-start-attempt-1\.log/.test(m)));
  } finally { h.restore() }
});

test('supabase logs are redacted before they are kept or uploaded, including postgres:// URLs and JWTs', () => {
  const body = source.match(/function logged\([^]*?\n}\n/)[0];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'outclass-redact-'));
  const lines = ['DB_URL: postgresql://postgres:postgres@127.0.0.1:55322/postgres', 'auth: connecting to postgres://supabase_auth_admin:pw@db:5432/postgres', 'token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.sig', 'Started supabase local development setup.'];
  const spawnSync = (_exe, _argv, { stdio }) => { fs.writeSync(stdio[1], lines.join('\n')); return { status: 1 } };
  const logged = new Function('fs', 'path', 'root', 'spawnSync', 'invocation', 'repo', 'process', `${body}\nreturn logged;`)(fs, path, root, spawnSync, (b, a) => [b, a], root, process);
  assert.throws(() => logged('supabase', ['start'], 'supabase-start.log'));
  const kept = fs.readFileSync(path.join(root, 'supabase-start.log'), 'utf8');
  assert.doesNotMatch(kept, /postgres(ql)?:\/\/|eyJ/);
  assert.match(kept, /Started supabase local development setup/);
});
