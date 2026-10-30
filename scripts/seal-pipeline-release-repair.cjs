// Run after final reports are written. Seals evidence without changing raw rows.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const repo = path.resolve(__dirname, '..');
const root = path.join(repo, 'docs/performance/pipeline-release-repair');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file)));
const proof = read('revision-2/SOURCE_PROOF.json');
const report = read('revision-2/BENCHMARKS.json');
assert.equal(report.releaseClearance, true, 'Complete performance and independent functional clearance required');
assert.equal(report.applicationDigest, proof.digest);
assert.equal(report.baseline, proof.base);
assert.ok(report.gates.every(gate => gate.status === 'PASS'));
assert.equal(report.requiredBrowserUnitsComplete, true);
assert.equal(report.gates.length, 34);
assert.equal(report.comparisons.length, 92);
const browserGroups = report.comparisons.filter(group => group.kind !== 'capacity');
assert.equal(browserGroups.reduce((n, group) => n + group.attempted, 0), 1120);
assert.equal(report.attempts.filter(a => a.collector).length, 16);
assert.ok(report.attempts.every(a => a.timingEligible));
assert.equal(report.attempts.filter(a => a.collector).reduce((n, a) => n + a.warmupsExcluded, 0), 320);
const capacity = report.attempts.find(a => a.kind === 'capacity');
assert.equal(capacity.measured, 140); assert.equal(capacity.warmupsExcluded, 56);
for (const group of report.comparisons) {
  assert.equal(group.attempted, group.expectedSamples);
  assert.equal(group.successful, group.attempted);
  const latency = group.metrics[group.kind === 'capacity' ? 'elapsedMs' : 'meaningfulMs'];
  assert.equal(latency.samples, group.expectedSamples);
  assert.ok([latency.p50, latency.p95, latency.max].every(Number.isFinite));
}
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: repo }).toString().split('\0');
const applicationFiles = tracked.filter(p => /^(actions|app|components|contexts|hooks|lib|utils|public|styles|prisma)\//.test(p) ||
  /^(middleware\.ts|next\.config\.mjs|package\.json|pnpm-lock\.yaml|tsconfig\.json)$/.test(p)).sort();
const applicationHashes = Object.fromEntries(applicationFiles.map(file => [file, hash(fs.readFileSync(path.join(repo, file)))]));
assert.deepEqual(applicationHashes, proof.hashes, 'Application drift after measurement');
assert.equal(hash(JSON.stringify(applicationHashes)), proof.digest);
const acceptance = fs.readFileSync(path.join(root, 'ACCEPTANCE.md'));
const originalAcceptance = execFileSync('git', ['show', 'b2d8883da60a991c22e7596fd2dccc9cf981461b:docs/performance/pipeline-release-repair/ACCEPTANCE.md'], { cwd: repo });
assert.equal(hash(acceptance), hash(originalAcceptance), 'Frozen acceptance changed');
for (const attempt of report.attempts.filter(a => a.timingEligible)) {
  const protocol = read(path.join(attempt.directory, attempt.kind === 'capacity' ? 'RESULTS.json' : 'PROTOCOL.json'));
  for (const [file, expected] of Object.entries(protocol.toolHashes))
    assert.equal(hash(fs.readFileSync(path.join(repo, file))), expected, 'Collector drift: ' + file);
}
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    assert.ok(!entry.isSymbolicLink(), 'Evidence must not link to private external files');
    return entry.isDirectory() ? walk(filename) : [filename];
  });
}
const evidenceHashes = Object.fromEntries(walk(root).map(file => path.relative(root, file)).filter(file => file !== 'EVIDENCE_SEAL.json').sort()
  .map(file => [file, hash(fs.readFileSync(path.join(root, file)))]));
const manifest = {
  generatedAt: new Date().toISOString(),
  measuredMain: proof.base,
  measuredApplicationSource: proof.candidate,
  parentHeadBeforeEvidenceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  applicationFiles: applicationFiles.length,
  applicationDigest: proof.digest,
  applicationHashes,
  analysisToolHashes: Object.fromEntries(['scripts/pipeline-release-summary.cjs', 'scripts/summarize-pipeline-release-revision-2.cjs', 'scripts/seal-pipeline-release-repair.cjs']
    .map(file => [file, hash(fs.readFileSync(path.join(repo, file)))])),
  acceptanceSha256: hash(acceptance),
  performanceClearance: report.performanceClearance,
  independentFunctionalClearance: report.independentFunctionalQAClearance,
  applicationReleaseClearance: report.releaseClearance,
  evidenceFiles: Object.keys(evidenceHashes).length,
  evidenceDigest: hash(JSON.stringify(evidenceHashes)),
  evidenceHashes,
  scope: 'Application source matches measured code. Every retained evidence file is hashed, including old failures and complete exclusions. This seal excludes only itself. Final PR head checks, measured-main identity and resulting main tree are verified separately before/after the authorized merge.',
};
if (process.argv.includes('--verify')) {
  const sealed = read('EVIDENCE_SEAL.json');
  for (const key of ['measuredMain', 'measuredApplicationSource', 'applicationFiles', 'applicationDigest', 'applicationHashes', 'analysisToolHashes', 'acceptanceSha256', 'performanceClearance', 'independentFunctionalClearance', 'applicationReleaseClearance', 'evidenceFiles', 'evidenceDigest', 'evidenceHashes'])
    assert.deepEqual(manifest[key], sealed[key], 'Seal verification failed: ' + key);
  console.log('Sealed source and every retained evidence file verified without modification.');
  process.exit(0);
}
fs.writeFileSync(path.join(root, 'EVIDENCE_SEAL.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ applicationFiles: manifest.applicationFiles, applicationDigest: manifest.applicationDigest,
  evidenceFiles: manifest.evidenceFiles, evidenceDigest: manifest.evidenceDigest, applicationReleaseClearance: true }));
