// Matched frozen-build study. Product readiness, request draining and network
// conditions are the existing harness; font diagnostics only observe the page.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process'), { createHash } = require('node:crypto');
const local = require('./navigation-phase15-local.cjs');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function main() {
  const profile = process.argv.find(a => a.startsWith('--profile='))?.slice(10);
  assert.ok(['local', 'constrained'].includes(profile));
  const out = path.join(local.repo, 'docs/performance/phase15', profile);
  assert.ok(!fs.existsSync(out)); fs.mkdirSync(out);
  const toolNames = ['navigation-phase15-study.cjs', 'navigation-phase15-local.cjs', 'navigation-audit.cjs', 'navigation-phase15-interactions.cjs', 'navigation-phase15-constrained-interactions.cjs', 'navigation-phase15-concurrency.cjs', 'navigation-phase15-host-monitor.cjs'];
  const protocol = { startedAt: new Date().toISOString(), profile, cohorts: [1000, 5000], blocks: ['BA', 'AB'], buildIds: {}, planSha256: hash(path.join(local.repo, 'docs/performance/phase15/PLAN.json')), tools: Object.fromEntries(toolNames.map(f => [f, hash(path.join(local.repo, 'scripts', f))])), completed: [], interactions: [], concurrency: [], features: [], failures: [], complete: false };
  const save = () => fs.writeFileSync(path.join(out, 'PROTOCOL.json'), JSON.stringify(protocol, null, 2) + '\n'); save();
  const host = require('./navigation-phase15-host-monitor.cjs').startMonitor({ repo: local.repo, output: path.join(out, 'HOST_MONITOR.json') });
  protocol.runtimePackageManifests = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(local.repo, 'docs/performance/phase15/RUNTIME_PACKAGES.json')))).map(([name, spec]) => [name, spec.sha256])); save();
  const currentSource = JSON.parse(fs.readFileSync(path.join(local.repo, 'docs/performance/phase15/CANDIDATE_SOURCE.json')));
  const verifySources = () => { for (const [file, digest] of Object.entries(currentSource.files)) assert.equal(hash(path.join(local.repo, file)), digest, file); for (const [name, digest] of Object.entries(protocol.runtimePackageManifests)) assert.equal(hash(path.join(local.repo, 'node_modules', name, 'package.json')), digest, name); host.assertClean(); };
  async function run(script, args, logName) {
    host.setPhase(path.basename(args.find(a => a.startsWith('--out='))?.slice(6) || script));
    const fd = fs.openSync(path.join(local.root, logName), 'a');
    try { const child = spawn(process.execPath, [script, ...args], { cwd: local.repo, env: local.environment(), stdio: ['ignore', fd, fd] }); const status = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); }); host.assertClean(); return status; }
    finally { fs.closeSync(fd); }
  }
  try {
    verifySources();
    for (const size of protocol.cohorts) {
      await local.stop(); fs.copyFileSync(path.join(local.privateRoot(), `fixture-${size}.json`), path.join(local.root, 'navigation-fixture.json'));
      for (const [pair, order] of protocol.blocks.entries()) for (const [position, variant] of [...order].entries()) {
        const build = variant === 'B' ? 'baseline' : 'candidate'; await local.start(build);
        protocol.buildIds[build] = fs.readFileSync(path.join(local.dist, 'BUILD_ID'), 'utf8').trim();
        const stem = `size-${size}-pair-${pair + 1}-${position + 1}-${variant}`;
        for (const [phase, n] of [['warmup', 1], ['measure', 5]]) {
          const directory = stem + '-' + phase;
          const status = await run('scripts/navigation-audit.cjs', ['--phase2', '--phase3', '--cold-warm', '--record-failures', '--source-diagnostics', '--font-diagnostics', ...(profile === 'constrained' ? ['--constrained-network'] : []), '--samples=' + n, '--out=' + path.join(out, directory)], 'phase15-study.log');
          const data = JSON.parse(fs.readFileSync(path.join(out, directory, 'browser-samples.json')));
          assert.equal(data.samples.length, n * 4); assert.equal(status, data.failures.length ? 1 : 0);
          protocol.completed.push({ directory, planned: n * 4, observed: data.samples.length, failed: data.failures.length }); save();
        }
        if (size === 1000) {
          for (const [phase, n] of [['warmup', 1], ['measure', 3]]) {
            const directory = stem + '-features-' + phase;
            const status = await run('scripts/navigation-audit.cjs', ['--phase2', '--deferred-screens', '--cold-warm', '--record-failures', '--source-diagnostics', '--font-diagnostics', ...(profile === 'constrained' ? ['--constrained-network'] : []), '--samples=' + n, '--out=' + path.join(out, directory)], 'phase15-feature-study.log');
            const data = JSON.parse(fs.readFileSync(path.join(out, directory, 'browser-samples.json')));
            assert.equal(data.samples.length, n * 8); assert.equal(status, data.failures.length ? 1 : 0);
            protocol.features.push({ directory, planned: n * 8, observed: data.samples.length, failed: data.failures.length }); save();
          }
        }
        const interactionFile = stem + '-interactions.json';
        const status = await run('scripts/navigation-phase15-' + (profile === 'constrained' ? 'constrained-interactions' : 'interactions') + '.cjs', ['--out=' + path.join(out, interactionFile)], 'phase15-interactions.log');
        const interactions = JSON.parse(fs.readFileSync(path.join(out, interactionFile)));
        assert.equal(interactions.samples.length, 12); assert.equal(status, interactions.samples.some(s => s.failed) ? 1 : 0);
        protocol.interactions.push({ file: interactionFile, planned: 12, observed: interactions.samples.length, failed: interactions.samples.filter(s => s.failed).length }); save();
        if (profile === 'constrained') {
          const file = stem + '-concurrency.json';
          assert.equal(await run('scripts/navigation-phase15-concurrency.cjs', ['--kind=pipelinePage', '--out=' + path.join(out, file)], 'phase15-concurrency.log'), 0);
          protocol.concurrency.push({ file, planned: 42 }); save();
        }
        verifySources();
        console.log(`Completed ${profile}, ${size} applicants, pair ${pair + 1}, ${variant}`);
      }
    }
    protocol.complete = true; protocol.completedAt = new Date().toISOString(); save();
  } catch (error) {
    protocol.failures.push({ name: error.name, message: error.message.split('\n')[0] }); save(); throw error;
  } finally { await local.stop(); protocol.hostControl = host.stop(); if (!protocol.hostControl.valid) { protocol.complete = false; protocol.failures.push({ name: 'HostControlViolation', message: 'Entire profile retained; no individual row replacement.' }); process.exitCode = 1; } protocol.applicationStopped = true; save(); }
}
if (require.main === module) main().catch(error => { console.error(error.name + ': Phase 15 study failed'); process.exitCode = 1; });
