// Local diagnostic study only. Never reads application .env or hosted credentials.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const { createHash, randomBytes } = require('node:crypto');
const { spawn, spawnSync, execFileSync } = require('node:child_process');
const { fixtureProfile } = require('./navigation-fixture-config.cjs');
const profile = fixtureProfile('crossover'), repo = path.resolve(__dirname, '..');
const sha = body => createHash('sha256').update(body).digest('hex');

function protocol(seed) {
  assert.match(seed, /^[a-f0-9]{32}$/);
  const orders = ['AB', 'AB', 'BA', 'BA'].map((order, i) => ({ order, sort: sha(seed + ':' + i) })).sort((a, b) => a.sort.localeCompare(b.sort));
  orders.splice(2, 0, { order: 'AA' });
  return orders.flatMap(({ order }, pair) => [...order].map((variant, position) => ({ pair, position, variant, comparison: order === 'AA' ? 'same-build-control' : 'hydration-wrapper', order })));
}
function controlLayout(source) {
  const imported = 'import { RouteContent } from "@/components/route-content"\n';
  const wrapped = '<RouteContent style={cookieStore.has(PLATFORM_VIEW_COOKIE) ? { paddingTop: "var(--support-banner-height, 120px)" } : undefined}>{children}</RouteContent>';
  assert.equal(source.split(imported).length, 2, 'Expected exactly one route wrapper import');
  assert.equal(source.split(wrapped).length, 2, 'Expected exactly one route wrapper');
  return source.replace(imported, '').replace(wrapped, '<div className="oc-route-content" style={cookieStore.has(PLATFORM_VIEW_COOKIE) ? { paddingTop: "var(--support-banner-height, 120px)" } : undefined}>{children}</div>');
}
function validateCohort(data, waves) {
  assert.equal(data.samples.length, waves * 8, 'Every predetermined participant navigation must be retained');
  for (const row of data.samples) {
    assert.equal(row.renderedRooms, 24); assert.equal(row.openInterviewLinks, 24);
    assert.ok(row.requests.every(r => Number.isInteger(r.status) && r.status >= 200 && r.status < 400 && !r.failed), 'Request failure invalidates the study block');
  }
  assert.ok(data.failures.every(f => ['browser_script_error', 'hydration_recovery'].includes(f.assertion)), 'Only recorded browser recoveries may continue the comparison');
}
function cpu() { return os.cpus().reduce((sum, core) => ({ idle: sum.idle + core.times.idle, total: sum.total + Object.values(core.times).reduce((a, b) => a + b, 0) }), { idle: 0, total: 0 }); }
async function portFree(port) {
  await new Promise((resolve, reject) => { const server = require('node:net').createServer(); server.once('error', () => reject(Error('Reserved crossover port is occupied: ' + port))); server.listen(port, '127.0.0.1', () => server.close(resolve)); });
}
async function main() {
  const output = process.argv.find(a => a.startsWith('--out='))?.slice(6);
  assert.ok(output, 'An explicit new output directory is required');
  const out = path.resolve(output), allowed = path.join(repo, 'docs/performance/phase1/active-workload');
  assert.ok(out.startsWith(allowed + path.sep) && !fs.existsSync(out), 'Use a new active-workload evidence directory');
  assert.ok(!fs.existsSync(profile.root), 'Reserved crossover fixture already exists; refusing to replace it');
  for (const port of [3119, 59320, 59321, 59322, 59323, 59324, 59325, 59327, 59329]) await portFree(port);
  assert.equal(execFileSync('docker', ['ps', '-a', '--filter', 'label=com.supabase.cli.project=' + profile.projectId, '--format', '{{.Names}}'], { encoding: 'utf8' }).trim(), '', 'Reserved crossover project already exists');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  const seed = process.argv.find(a => a.startsWith('--seed='))?.slice(7) || randomBytes(16).toString('hex'), blocks = protocol(seed), buildRoots = { A: path.join(profile.root, 'build-a'), B: path.join(profile.root, 'build-b') };
  fs.mkdirSync(profile.root, { mode: 0o700 }); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(profile.root, '.crossover-owner'), head, { mode: 0o600 });
  const study = { sourceCommit: head, seed, blocks, variants: { A: 'Current HEAD including hydration wrapper', B: 'Same HEAD with only the root layout wrapper removed' }, clients: 4, wavesPerConditionPerBlock: 5, warmupWavesPerCondition: 1, conditions: ['cold', 'warm'], poolLimitPerPrismaClient: 8, notes: ['Same accounts, bookings, grants, database, URL and pool across every block.', 'Both builds completed before collection. No other tests or builds launched by this study during collection.', 'No busy-host samples dropped, no synthetic application delays.', 'Four AB/BA pairs are primary; the middle AA pair measures ordinary same-build variation.', 'Cold browser with warm server/database; initial page errors and incomplete blocks retained.', 'System telemetry contains aggregate CPU, load and memory only.'], completed: [] };
  const save = () => fs.writeFileSync(path.join(out, 'PROTOCOL.json'), JSON.stringify(study, null, 2) + '\n'); save();
  study.warmupFailurePolicy = 'One fixed warmup wave per condition, with no retries. Preserve all warmup failures and missing rows; do not silently force clean warmups. Every measured block must still be complete before accepted latency analysis.'; save();
  let running, appPid, stackTouched = false, sampler, abortRequested = false, phase = 'setup', blockIndex = -1;
  const run = async (args, log, cwd = repo, env = process.env) => {
    assert.ok(!abortRequested, 'Study interrupted');
    const fd = fs.openSync(path.join(profile.root, log), 'w');
    const child = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', fd, fd] }); running = child;
    const status = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    fs.closeSync(fd); running = null; assert.ok(!abortRequested, 'Study interrupted'); return status;
  };
  const stop = async () => {
    if (!fs.existsSync(path.join(profile.root, 'server.pid'))) return;
    const pid = Number(fs.readFileSync(path.join(profile.root, 'server.pid'), 'utf8'));
    const listener = spawnSync('lsof', ['-tiTCP:3119', '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout.trim();
    if (!listener) { appPid = null; return; }
    assert.equal(Number(listener), pid, 'Only the registered crossover listener can stop');
    const cwd = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' }).split('\n').find(x => x.startsWith('n'))?.slice(1);
    assert.ok(Object.values(buildRoots).map(p => fs.realpathSync(p)).includes(fs.realpathSync(cwd)), 'Crossover app checkout does not match');
    process.kill(pid, 'SIGTERM');
    for (let i = 0; i < 100; i++) { if (!spawnSync('lsof', ['-tiTCP:3119', '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout.trim()) { appPid = null; return; } await new Promise(r => setTimeout(r, 50)); }
    throw Error('Crossover application did not stop');
  };
  const abort = () => { abortRequested = true; if (running) running.kill('SIGTERM'); process.exitCode = 1; };
  process.once('SIGINT', abort); process.once('SIGTERM', abort);
  try {
    const registered = spawnSync(process.execPath, [path.join(repo, 'scripts/summarize-navigation-crossover.cjs'), '--plan', '--out=' + out], { cwd: repo, stdio: 'pipe' });
    assert.equal(registered.status, 0, 'Analysis registration must finish before building or collecting');
    const tar = path.join(profile.root, 'source.tar'); execFileSync('git', ['archive', '--format=tar', '-o', tar, head], { cwd: repo });
    for (const source of Object.values(buildRoots)) { fs.mkdirSync(source); execFileSync('tar', ['-xf', tar, '-C', source]); fs.symlinkSync(path.join(repo, 'node_modules'), path.join(source, 'node_modules'), 'dir'); }
    fs.rmSync(tar);
    const layout = fs.readFileSync(path.join(buildRoots.A, 'app/layout.tsx'), 'utf8'); fs.writeFileSync(path.join(buildRoots.B, 'app/layout.tsx'), controlLayout(layout));
    for (const file of ['scripts/run-onboarding-e2e.cjs', 'tests/helpers/onboarding-e2e.cjs']) {
      const full = path.join(buildRoots.A, file); let text = fs.readFileSync(full, 'utf8').replaceAll('outclass-onboarding-e2e', profile.projectId).replaceAll('553', '593').replaceAll('3107', '3119');
      if (file.startsWith('scripts/')) { assert.ok(text.includes('if(keep){console.log')); text = text.replace('if(keep){console.log', 'if(keep){app.unref();console.log'); }
      fs.writeFileSync(full, text);
    }
    console.log('Preparing private current-HEAD build, real Auth and disposable database.'); stackTouched = true;
    assert.equal(await run(['scripts/run-onboarding-e2e.cjs', '--keep'], 'setup.log', buildRoots.A), 0, 'Private setup/security suite failed; inspect reserved setup log');
    await stop();
    const configFile = path.join(profile.root, 'config.json'), config = profile.readConfig(configFile), s = config.status;
    const setupLog = fs.readFileSync(path.join(profile.root, 'setup.log'), 'utf8'); study.setupTestSummary = setupLog.split('\n').filter(l => l.startsWith('ℹ '));
    const pool = new URL(s.DB_URL); pool.searchParams.set('connection_limit', '8');
    const env = { ...process.env, NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH: 'false', DATABASE_URL: pool.href, POSTGRES_PRISMA_URL: pool.href, POSTGRES_URL: pool.href, POSTGRES_URL_NON_POOLING: pool.href, NEXT_PUBLIC_SUPABASE_URL: s.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: s.PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY: s.ANON_KEY, SUPABASE_SECRET_KEY: s.SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY: s.SERVICE_ROLE_KEY, OUTCLASS_PUBLISH_BUILD: '1', OUTCLASS_SITE_URL: config.appUrl, OUTCLASS_PLATFORM_ADMIN_IDS: config.admin.id, COMMUNICATIONS_EMAIL_ENABLED: 'false', RESEND_API_KEY: '', RESEND_FROM_EMAIL: '', NODE_EXTRA_CA_CERTS: path.join(profile.root, 'mailpit-cert.pem') };
    console.log('Building control with identical infrastructure and unchanged protected loaders.');
    assert.equal(await run(['scripts/copy-pdfjs-assets.cjs'], 'control-assets.log', buildRoots.B, env), 0, 'Control public assets failed');
    assert.equal(await run([path.join(repo, 'node_modules/next/dist/bin/next'), 'build'], 'control-build.log', buildRoots.B, env), 0, 'Control build failed');
    study.builds = Object.fromEntries(Object.entries(buildRoots).map(([v, p]) => [v, { buildId: fs.readFileSync(path.join(p, '.next-publish/BUILD_ID'), 'utf8').trim(), layoutSha256: sha(fs.readFileSync(path.join(p, 'app/layout.tsx'))) }])); save();
    assert.equal(await run(['scripts/navigation-audit.cjs', '--crossover-fixture', '--active-rooms', '--seed'], 'seed.log'), 0, 'Fresh active fixture failed');
    const telemetry = []; let last = cpu(); phase = 'starting';
    sampler = setInterval(() => { const next = cpu(), total = next.total - last.total; telemetry.push({ at: new Date().toISOString(), block: blockIndex, phase, cpuBusyPercent: total ? Math.round(10000 * (1 - (next.idle - last.idle) / total)) / 100 : null, loadAverage: os.loadavg(), freeMemoryMiB: Math.round(os.freemem() / 1048576) }); last = next; }, 1000);
    for (let i = 0; i < blocks.length; i++) {
      assert.ok(!abortRequested, 'Study interrupted');
      blockIndex = i; const block = blocks[i], source = buildRoots[block.variant]; phase = 'starting'; await stop();
      const fd = fs.openSync(path.join(profile.root, 'server-' + i + '.log'), 'w');
      const app = spawn(process.execPath, [path.join(repo, 'node_modules/next/dist/bin/next'), 'start', '-p', '3119', '-H', '127.0.0.1'], { cwd: source, env, detached: true, stdio: ['ignore', fd, fd] }); fs.closeSync(fd); app.unref(); appPid = app.pid;
      fs.writeFileSync(path.join(profile.root, 'server.pid'), String(appPid));
      config.buildDir = path.join(source, '.next-publish'); config.activeWorkload = { target: block.variant, sourceCommit: head, applicationSourcesModified: block.variant === 'B', poolLimitPerPrismaClient: 8, buildId: study.builds[block.variant].buildId, block: i };
      fs.writeFileSync(configFile, JSON.stringify(config), { mode: 0o600 });
      let ready = false;
      for (let n = 0; n < 100; n++) { try { if ((await fetch(profile.appUrl, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 200)); }
      assert.ok(ready, 'Registered crossover application did not start');
      for (const [name, waves] of [['warmup', 1], ['measure', 5]]) {
        phase = name; const destination = path.join(out, 'block-' + String(i + 1).padStart(2, '0') + '-' + block.variant + '-' + name);
        const exit = await run(['scripts/navigation-audit.cjs', '--crossover-fixture', '--diagnose-hydration', '--active-rooms', '--clients=4', '--samples=' + waves, '--out=' + destination], 'benchmark-' + i + '-' + name + '.log');
        const data = JSON.parse(fs.readFileSync(path.join(destination, 'browser-samples.json')));
        if (name === 'measure') validateCohort(data, waves);
        assert.ok(exit === 0 || data.failures.length, 'Unexpected benchmark exit');
        study.completed.push({ block: i, phase: name, variant: block.variant, observations: data.samples.length, plannedObservations: waves * 8, browserErrors: data.samples.reduce((n, r) => n + r.pageErrorCount, 0), failures: data.failures.length, exit }); save();
        fs.writeFileSync(path.join(out, 'SYSTEM.json'), JSON.stringify(telemetry, null, 2) + '\n');
      }
      console.log('Crossover block ' + (i + 1) + '/' + blocks.length + ' ' + block.variant + ' complete; all rows and errors retained.');
    }
    study.collectionComplete = true; save();
  } catch (error) {
    study.failure = { stage: phase, block: blockIndex, kind: error.name }; save(); throw error;
  } finally {
    if (sampler) clearInterval(sampler);
    if (running) running.kill('SIGTERM');
    await stop();
    if (stackTouched) {
      const fd = fs.openSync(path.join(profile.root, 'cleanup.log'), 'w'); const result = spawnSync(process.execPath, [path.join(repo, 'node_modules/supabase/dist/supabase.js'), 'stop', '--workdir', profile.root, '--no-backup'], { stdio: ['ignore', fd, fd] }); fs.closeSync(fd); assert.equal(result.status, 0, 'Reserved crossover stack did not stop');
    }
    assert.equal(execFileSync('docker', ['ps', '-a', '--filter', 'label=com.supabase.cli.project=' + profile.projectId, '--format', '{{.Names}}'], { encoding: 'utf8' }).trim(), '');
    assert.equal(fs.readFileSync(path.join(profile.root, '.crossover-owner'), 'utf8'), head);
    fs.rmSync(profile.root, { recursive: true, force: true });
    study.cleanup = { appStopped: !appPid, ownContainersRemoved: true, credentialsAndPrivateArchivesRemoved: true, unrelatedStacksUntouched: true }; save();
    process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort);
  }
}
module.exports = { protocol, controlLayout, validateCohort };
if (require.main === module) main().catch(error => { console.error(error.name + ': ' + String(error.message).split('\n')[0]); process.exitCode = 1; });
