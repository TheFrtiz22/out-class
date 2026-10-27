// Separate instrumented diagnosis. Never pool these rows into primary benchmarks.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const crypto = require('node:crypto'), cp = require('node:child_process');
const { promisify } = require('node:util');
const { PrismaClient } = require('@prisma/client');
const local = require('./navigation-followup-local.cjs');
const sanitize = require('./navigation-followup-provider-events.cjs');
const execFile = promisify(cp.execFile);
const root = path.join(local.repo, 'docs/performance/followup-20261027');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function validateOutput(value, repo = local.repo) {
  const parent = path.join(repo, 'docs/performance/followup-20261027');
  const output = path.resolve(value);
  assert.equal(path.dirname(output), parent, 'Only the separate followup output directory is allowed');
  assert.match(path.basename(output), /^diagnosis-[a-z0-9-]+$/);
  assert.ok(!fs.existsSync(output), 'Existing evidence must not be overwritten');
  return output;
}

async function main() {
  const output = validateOutput(process.argv.find(arg => arg.startsWith('--out='))?.slice(6) || path.join(root, 'diagnosis-1'));
  const config = local.config(), source = read(path.join(root, 'RETAINED_SOURCE.json'));
  assert.equal(config.appUrl, 'http://127.0.0.1:3107');
  assert.equal(new URL(config.status.DB_URL).hostname, '127.0.0.1');
  const containers = ['supabase_auth_outclass-onboarding-e2e', 'supabase_db_outclass-onboarding-e2e'];
  for (const name of containers) assert.equal(cp.execFileSync('docker', ['inspect', name, '--format', '{{index .Config.Labels "com.supabase.cli.project"}}'], { encoding: 'utf8' }).trim(), 'outclass-onboarding-e2e');
  assert.equal(cp.execFileSync('docker', ['inspect', containers[0], '--format', '{{.Config.Image}}'], { encoding: 'utf8' }).trim(), read(path.join(root, 'PROVIDER_SOURCE.json')).providerImage);
  const fixtureFile = path.join(local.root, 'navigation-fixture.json'), fixture = read(fixtureFile), fixtureHash = hash(fixtureFile);
  fs.mkdirSync(output);
  const tools = ['navigation-audit.cjs', 'navigation-followup-local.cjs', 'navigation-followup-server-diagnostics.cjs', 'navigation-followup-provider-events.cjs', 'navigation-followup-study.cjs', 'navigation-phase15-host-monitor.cjs'];
  const state = { acceptedPerformanceData: false, startedAt: new Date().toISOString(), complete: false, sourceRef: source.sourceRef, buildId: source.buildId, planSha256: hash(path.join(root, 'PLAN.json')), tools: Object.fromEntries(tools.map(file => [file, hash(path.join(local.repo, 'scripts', file))])), blocks: [], failures: [], backgroundFailures: [] };
  const save = () => fs.writeFileSync(path.join(output, 'PROTOCOL.json'), JSON.stringify(state, null, 2) + '\n');
  save();
  const log = path.join(local.root, 'followup-server.log'), offset = fs.existsSync(log) ? fs.statSync(log).size : 0;
  const host = require('./navigation-phase15-host-monitor.cjs').startMonitor({ repo: local.repo, output: path.join(output, 'HOST_MONITOR.json') });
  const url = new URL(config.status.DB_URL); url.searchParams.set('connection_limit', '1');
  const db = new PrismaClient({ datasourceUrl: url.href });
  let monitoring = false, poolPoll, containerPoll;
  const poolSamples = [], containerSamples = [];
  try {
    assert.equal(await db.application.count({ where: { clubId: fixture.clubIds[0] } }), 1000);
    for (const [file, digest] of Object.entries(source.files)) assert.equal(hash(path.join(local.repo, file)), digest, file);
    host.assertClean(); await local.start('baseline', true);
    assert.equal(fs.readFileSync(path.join(local.dist, 'BUILD_ID'), 'utf8').trim(), source.buildId);
    monitoring = true;
    poolPoll = (async () => {
      while (monitoring) {
        const rows = await db.$queryRaw`SELECT CASE WHEN usename=current_user THEN 'app_role' WHEN usename='supabase_auth_admin' THEN 'auth_role' ELSE 'other_role' END AS category,count(*)::int AS connections,count(*) FILTER(WHERE state='active')::int AS active,count(*) FILTER(WHERE state='idle in transaction')::int AS idle_in_transaction,count(*) FILTER(WHERE wait_event_type='Lock')::int AS lock_waiting,count(*) FILTER(WHERE wait_event_type='IO')::int AS io_waiting,count(*) FILTER(WHERE wait_event_type='LWLock')::int AS lwlock_waiting,count(*) FILTER(WHERE wait_event_type='Client')::int AS client_waiting FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid() GROUP BY category`;
        poolSamples.push({ at: new Date().toISOString(), rows });
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    })().catch(() => { state.backgroundFailures.push('database_sampler'); monitoring = false; });
    containerPoll = (async () => {
      while (monitoring) {
        const response = await execFile('docker', ['stats', '--no-stream', '--format', '{{json .}}', ...containers], { timeout: 10000, maxBuffer: 1e6 });
        containerSamples.push({ at: new Date().toISOString(), rows: response.stdout.trim().split('\n').map(sanitize.containerStats).filter(Boolean) });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    })().catch(() => { state.backgroundFailures.push('container_sampler'); monitoring = false; });
    for (let batch = 1; batch <= 4; batch++) {
      for (const [file, digest] of Object.entries(source.files)) assert.equal(hash(path.join(local.repo, file)), digest, file);
      for (const [file, digest] of Object.entries(state.tools)) assert.equal(hash(path.join(local.repo, 'scripts', file)), digest, file);
      assert.equal(hash(path.join(root, 'PLAN.json')), state.planSha256);
      assert.equal(hash(fixtureFile), fixtureHash);
      host.assertClean(); host.setPhase('diagnostic-feature-batch-' + batch);
      const directory = 'batch-' + batch, fd = fs.openSync(path.join(local.root, 'followup-browser.log'), 'a');
      let status;
      try {
        const child = cp.spawn(process.execPath, ['scripts/navigation-audit.cjs', '--phase2', '--deferred-screens', '--cold-warm', '--record-failures', '--source-diagnostics', '--font-diagnostics', '--constrained-network', '--samples=5', '--out=' + path.join(output, directory)], { cwd: local.repo, env: local.environment(), stdio: ['ignore', fd, fd] });
        status = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
      } finally { fs.closeSync(fd); }
      const data = read(path.join(output, directory, 'browser-samples.json'));
      state.blocks.push({ directory, status, planned: 40, observed: data.samples.length, failed: data.failures.length }); save();
      assert.equal(status, 0); assert.equal(data.samples.length, 40); assert.deepEqual(data.failures, []);
      host.assertClean(); assert.deepEqual(state.backgroundFailures, []); console.log('Completed followup diagnostic batch ' + batch + '/4');
    }
    state.complete = true;
  } catch (error) {
    state.failures.push({ type: error.name, reason: 'Diagnostic attempt failed; retain the complete observations and inspect privately before acceptance.' });
    throw error;
  } finally {
    monitoring = false;
    const polls = await Promise.allSettled([poolPoll, containerPoll].filter(Boolean));
    state.samplerFailures = polls.filter(row => row.status === 'rejected').length + state.backgroundFailures.length;
    await db.$disconnect(); await local.stop();
    state.completedAt = new Date().toISOString(); state.hostControl = host.stop(); state.applicationStopped = true;
    const events = [];
    if (fs.existsSync(log)) for (const line of fs.readFileSync(log).subarray(offset).toString().split('\n')) {
      try { const event = JSON.parse(line); if (['followup.request', 'followup.event_loop', 'followup.gc', 'workspace.phases'].includes(event.event)) events.push(event); } catch {}
    }
    fs.writeFileSync(path.join(output, 'SERVER_EVENTS.json'), JSON.stringify({ scope: 'Fixed-label local runtime events only; overlapping process windows are not exclusive request CPU.', events }, null, 2) + '\n');
    const authLog = await execFile('docker', ['logs', '--since', state.startedAt, containers[0]], { maxBuffer: 32 * 1024 * 1024 });
    const providerEvents = (authLog.stdout + '\n' + authLog.stderr).split('\n').map(line => sanitize.authLogEvent(line, 'nanoseconds')).filter(Boolean);
    fs.writeFileSync(path.join(output, 'PROVIDER_EVENTS.json'), JSON.stringify({ source: '../PROVIDER_SOURCE.json; pinned gotrue:v2.197.0 middleware duration is nanoseconds.', exactPerRequestJoinAvailable: false, events: providerEvents }, null, 2) + '\n');
    fs.writeFileSync(path.join(output, 'RESOURCE_SAMPLES.json'), JSON.stringify({ scope: '250ms DB-role aggregates and bounded owned-service Docker counters; sampling can miss brief peaks.', poolSamples, containerSamples }, null, 2) + '\n');
    save();
  }
  assert.ok(state.complete && state.hostControl.valid && state.samplerFailures === 0);
  const audit = cp.spawnSync('python3', [path.join(root, '..', 'phase15/analysis/audit-power.py'), output], { cwd: local.repo, stdio: 'inherit' });
  assert.equal(audit.status, 0);
  console.log('Followup diagnosis complete; instrumented observations remain separate from benchmark quantiles.');
}

module.exports = { validateOutput };
if (require.main === module) main().catch(error => { console.error(error.name + ': followup diagnosis stopped; retain all observations.'); process.exitCode = 1; });
