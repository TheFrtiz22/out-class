// Paired current-main comparison; uses the existing collector without app changes.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process'), { createHash } = require('node:crypto');
const local = require('./navigation-selected-ready-local.cjs');
const { startMonitor } = require('./navigation-selected-ready-host-monitor.cjs');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function outputDirectory(profile, repo = local.repo) {
  assert.ok(['local', 'constrained'].includes(profile));
  const result = path.join(repo, 'docs/performance/selected-ready-20261027', profile);
  assert.ok(!fs.existsSync(result), 'Retain existing evidence; do not overwrite it');
  return result;
}
async function main() {
  const profile = process.argv.find(arg => arg.startsWith('--profile='))?.slice(10);
  const out = outputDirectory(profile), root = path.dirname(out), planFile = path.join(root, 'PLAN.json');
  const plan = read(planFile), candidate = read(path.join(root, 'CANDIDATE_SOURCE.json'));
  const baseline = read(path.join(root, 'BASELINE_SOURCE.json'));
  const fixtureFile = path.join(local.root, 'navigation-fixture.json'), fixture = read(fixtureFile);
  assert.equal(fixture.counts.applicantsInMeasuredClub ?? fixture.counts.applicantsPerClub, plan.fixtureApplicants);
  const frozen = Object.fromEntries(['navigation-audit.cjs', 'navigation-selected-ready-local.cjs', 'navigation-selected-ready-host-monitor.cjs', 'navigation-selected-ready-study.cjs'].map(file => [file, hash(path.join(local.repo, 'scripts', file))]));
  const fixtureHash = hash(fixtureFile), planHash = hash(planFile);
  fs.mkdirSync(out);
  const state = { startedAt: new Date().toISOString(), complete: false, profile, base: plan.base, builds: { B: baseline.buildId, A: candidate.buildId }, toolHashes: frozen, planSha256: planHash, blocks: [], failures: [] };
  const save = () => fs.writeFileSync(path.join(out, 'PROTOCOL.json'), JSON.stringify(state, null, 2) + '\n');
  const host = startMonitor({ repo: local.repo, output: path.join(out, 'HOST_MONITOR.json') });
  const check = () => {
    for (const [file, digest] of Object.entries(candidate.files)) assert.equal(hash(path.join(local.repo, file)), digest, file);
    for (const [file, digest] of Object.entries(frozen)) assert.equal(hash(path.join(local.repo, 'scripts', file)), digest, file);
    assert.equal(hash(planFile), planHash); assert.equal(hash(fixtureFile), fixtureHash); host.assertClean();
  };
  save();
  try {
    for (const [position, variant] of plan.order.entries()) {
      check(); host.setPhase(`${position + 1}-${variant}-start`);
      await local.start(variant === 'A' ? 'candidate' : 'baseline');
      assert.equal(fs.readFileSync(path.join(local.dist, 'BUILD_ID'), 'utf8').trim(), state.builds[variant]);
      for (const [stage, count] of [['warmup', plan.warmupsPerBlockGroup], ['measure', plan.measuredPerBlockGroup]]) {
        check(); const directory = `block-${position + 1}-${variant}-${stage}`; host.setPhase(directory);
        const fd = fs.openSync(path.join(local.root, 'selected-ready-study.log'), 'a');
        let status;
        try {
          const child = spawn(process.execPath, ['scripts/navigation-audit.cjs', ...plan.harnessFlags, ...(profile === 'constrained' ? ['--constrained-network'] : []), '--samples=' + count, '--out=' + path.join(out, directory)], { cwd: local.repo, env: local.environment(), stdio: ['ignore', fd, fd] });
          status = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
        } finally { fs.closeSync(fd); }
        const data = read(path.join(out, directory, 'browser-samples.json'));
        state.blocks.push({ directory, variant, stage, planned: count * 8, observed: data.samples.length, failures: data.failures.length, status }); save();
        assert.equal(data.samples.length, count * 8); assert.equal(status, 0); assert.deepEqual(data.failures, []);
        assert.ok(data.samples.every(row => !row.failed && row.pageErrorCount === 0)); check();
      }
      console.log(`${profile} block ${position + 1}/4 (${variant}) complete; all rows retained.`);
    }
    state.complete = true;
  } catch (error) {
    state.failures.push({ type: error.name, reason: 'Comparison failed; retain complete attempt and inspect before acceptance.' });
    throw error;
  } finally {
    await local.stop();
    fs.rmSync(local.dist, { recursive: true }); fs.cpSync(path.join(local.privateRoot(), 'candidate'), local.dist, { recursive: true });
    state.completedAt = new Date().toISOString(); state.hostControl = host.stop(); state.applicationStopped = true; save();
  }
}
module.exports = { outputDirectory };
if (require.main === module) main().catch(error => { console.error(error.name + ': selected startup comparison failed'); process.exitCode = 1; });
