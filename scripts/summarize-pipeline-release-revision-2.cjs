// Retained raw rows are immutable. Explicit collection receipts select units;
// incomplete assigned units are excluded in full, never pooled or salvaged.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { summarize } = require('./pipeline-release-summary.cjs');
const root = path.resolve(__dirname, '../docs/performance/pipeline-release-repair');
const read = p => JSON.parse(fs.readFileSync(p));
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const receipt = read(path.join(root, 'revision-2/COLLECTION.json'));
const report = { revision: 2, generatedAt: new Date().toISOString(), baseline: receipt.baseline,
  candidate: receipt.candidate, applicationDigest: receipt.applicationDigest,
  protocolSha256: hash(path.join(root, 'revision-2/PROTOCOL.md')),
  historicalEvidence: 'Revision 1 remains rejected at b2d8883d; no historical rows are paired with revision 2.',
  percentiles: 'Nearest rank; n10 p95 equals its maximum and is not a hosted p95 guarantee.',
  metricNotes: [
    'Each cohort/profile/collector is its own complete paired BAAB unit. Never pool hosts, changed source/tools, historical rows or incomplete units.',
    'Raw rows retain source preparation, click/content/readiness stages, continuous journey and network completion. Missing metrics remain null.',
    'Encoded bytes remain null when any contributing size is unknown; known partial bytes and unknown counts remain separate.',
    'For canceled primary-navigation requests, bodyBytesSource may be cdp_received_chunks_before_cancel: this is the observed received-chunk count, not a completed response body. Strict-collector canceled bodies generally remain unknown.',
    'Server-Timing spans overlap and must not be added as disjoint durations. Pure pool/lock and detailed Auth transport attribution is unavailable.',
    'Capacity transport failures are recorded, but separate browser-style aborted/pending classifications are unavailable for native HTTP rows.',
    'Browser/automation/observer costs are part of instrumented timings. CDP CPU/network emulation and a CI VM do not establish hosted or physical-device latency guarantees.',
    'Filtering/sorting/paging/history/revocation and live voting are functionally verified; separate controlled latency distributions for every individual operation are unavailable.',
    'First-source failures are retained in attempt-1/BENCHMARKS.json and are never relabeled or paired with this source.'
  ],
  attempts: [], excludedAttempts: [], comparisons: [], gates: [] };
const validSources = p => p.builds?.B?.commit === receipt.baseline && p.builds?.D?.digest === receipt.applicationDigest;
const seen = new Set();
for (const unit of receipt.units) {
  const filename = path.join(root, unit.directory, 'PROTOCOL.json');
  if (!fs.existsSync(filename)) { report.attempts.push({ ...unit, downloaded: false }); continue; }
  const p = read(filename);
  assert.equal(p.revision, 2); assert.equal(p.profile, unit.profile); assert.equal(p.collector, unit.collector);
  assert.deepEqual(p.cohorts, [unit.size]);
  const attested = p.blocks?.length === 4 && p.blocks.every((b, i) => b.variant === ['B','D','D','B'][i] && b.size === unit.size && b.attestation?.valid);
  const eligible = !!(p.complete && p.toolsVerified && p.sourcesVerified && p.hostAudit?.clockConsistent && p.timingEligible && attested && validSources(p) && p.revisionProtocolSha256 === report.protocolSha256);
  const attempt = { ...unit, protocolSha256: hash(filename), builds: p.builds, environment: p.environment,
    complete: p.complete, timingEligible: eligible, functionalFailures: p.functionalFailures,
    hostAudit: p.hostAudit, blocks: p.blocks, fixtures: p.fixtures };
  report.attempts.push(attempt);
  if (!eligible) { report.excludedAttempts.push({ directory: unit.directory, allSuccessfulRowsAlsoExcluded: true,
    reason: 'Whole assigned unit incomplete or failed source/build/protocol/host attestation' }); continue; }
  const identity = [unit.profile, unit.size, unit.collector].join('/');
  assert.ok(!seen.has(identity), 'Multiple eligible attempts for ' + identity); seen.add(identity);
  const groups = new Map(); let warmups = 0;
  for (const block of p.blocks) for (const c of block.collectors) {
    assert.equal(c.kind, unit.collector);
    const file = path.join(root, unit.directory, c.directory, c.kind === 'navigation' ? 'browser-samples.json' : 'workflow.json');
    const raw = read(file);
    if (c.warmup) { warmups += raw.samples.length; continue; }
    for (const row of raw.samples) {
      if (row.warmup) { warmups++; continue; }
      const key = JSON.stringify([block.variant, row.path || 'full-review', row.condition || 'full-review']);
      if (!groups.has(key)) groups.set(key, { rows: [], artifacts: new Set(), identity: { attempt: unit.directory,
        profile: unit.profile, size: unit.size, variant: block.variant,
        path: row.path || 'Overview → Applicants → detail/review → switch → search → selection → cold/warm Voting history → return',
        condition: row.condition || 'fresh source; warm assets after excluded warmups' } });
      const group = groups.get(key); group.rows.push(row); group.artifacts.add(path.relative(root, file));
    }
  }
  attempt.warmupsExcluded = warmups;
  for (const g of groups.values()) report.comparisons.push(summarize(g.rows, unit.collector, g.identity, [...g.artifacts]));
}
if (receipt.capacity) {
  const file = path.join(root, receipt.capacity.directory, 'RESULTS.json');
  if (fs.existsSync(file)) {
    const p = read(file), eligible = !!(p.complete && p.toolsVerified && p.sourcesVerified && p.hostAudit?.clockConsistent && p.timingEligible && p.attestations?.length === 8 && p.attestations.every(a => a.valid) && validSources(p));
    report.attempts.push({ kind: 'capacity', ...receipt.capacity, timingEligible: eligible, complete: p.complete,
      failures: p.failures, builds: p.builds, environment: p.environment, hostAudit: p.hostAudit,
      warmupsExcluded: p.rows.filter(r => r.warmup).length, measured: p.rows.filter(r => !r.warmup).length, poolLimit: p.poolLimit,
      attestations: p.attestations, monitorSamples: p.monitor.length,
      monitorMaxima: Object.fromEntries(['connections','active','idle_in_transaction','lock_waiting'].map(key => [key, p.monitor.length ? Math.max(...p.monitor.map(row => row[key])) : null])) });
    if (!eligible) report.excludedAttempts.push({ ...receipt.capacity, allSuccessfulRowsAlsoExcluded: true });
    else for (const size of p.cohorts) for (const variant of ['B','D']) for (const concurrency of p.concurrency) {
      const rows = p.rows.filter(r => !r.warmup && r.size === size && r.variant === variant && r.concurrency === concurrency);
      const group = summarize(rows, 'capacity', { attempt: receipt.capacity.directory, profile: 'local', size, variant,
        path: 'HTTP initial applicant read', condition: 'concurrency-' + concurrency }, [path.relative(root, file)]);
      group.errors.aborted = null; group.errors.pending = null;
      report.comparisons.push(group);
    }
  }
}
function pair(kind, size, profile, pathname, condition) {
  const rows = report.comparisons.filter(g => g.kind === kind && g.size === size && g.profile === profile && (!pathname || g.path === pathname) && (!condition || g.condition === condition));
  const b = rows.find(g => g.variant === 'B'), d = rows.find(g => g.variant === 'D');
  return b && d ? { b, d } : null;
}
const functional = g => g.completeSamples && !g.errors.failedOutcomes && !g.errors.httpErrors && !g.errors.pageErrors && !g.errors.sourceHttpErrors;
function latency(name, p, metric, r50, a50, r95, a95, stage) {
  const before = stage ? p?.b.stages[stage]?.[metric] : p?.b.metrics[metric];
  const after = stage ? p?.d.stages[stage]?.[metric] : p?.d.metrics[metric];
  const available = [before?.p50, before?.p95, after?.p50, after?.p95].every(Number.isFinite);
  const p50Limit = available && Number.isFinite(r50) ? before.p50 + Math.max(before.p50 * r50, a50) : null;
  const p95Limit = available ? before.p95 + Math.max(before.p95 * r95, a95) : null;
  report.gates.push({ name, status: !available ? 'MISSING' : functional(p.b) && functional(p.d) && (p50Limit === null || after.p50 <= p50Limit) && after.p95 <= p95Limit ? 'PASS' : 'FAIL', before, after, p50Limit, p95Limit });
}
for (const profile of ['local','constrained']) {
  for (const condition of ['cold','warm']) for (const [label, pathname] of [['detail','applicants → applicantDetail'],['directory','recruiting → applicants']])
    latency('one applicant ' + label + ' ' + profile + ' ' + condition, pair('navigation',1,profile,pathname,condition), 'meaningfulMs', .10,15,.15,30);
  const one = pair('full-review',1,profile), hundred = pair('full-review',100,profile);
  latency('one applicant complete review ' + profile, one, 'meaningfulMs', .10,15,.15,30);
  latency('one applicant continuous journey ' + profile, one, 'sourceThroughContentMs', .10,15,.15,30);
  latency('100 complete review ' + profile, hundred, 'meaningfulMs', .05,20,.10,40);
  latency('100 continuous source-through-content ' + profile, hundred, 'sourceThroughContentMs', .05,20,.10,40);
  for (const stage of ['votingCold','votingWarm']) latency('100 ' + stage + ' ' + profile, hundred, 'meaningfulMs', .05,20,.10,40,stage);
  for (const condition of ['cold','warm']) {
    const p = pair('navigation',1,profile,'applicants → applicantDetail',condition);
    report.gates.push({ name: 'one applicant guarded detail requests ' + profile + ' ' + condition,
      status: !p ? 'MISSING' : functional(p.b) && functional(p.d) && p.d.metrics.guardedWorkspaceRequestCount.max <= p.b.metrics.guardedWorkspaceRequestCount.max ? 'PASS' : 'FAIL',
      before: p?.b.metrics.guardedWorkspaceRequestCount, after: p?.d.metrics.guardedWorkspaceRequestCount });
  }
  report.gates.push({ name: '100 complete review guarded requests ' + profile,
    status: !hundred ? 'MISSING' : functional(hundred.b) && functional(hundred.d) && hundred.d.metrics.guardedWorkspaceRequestCount.max <= hundred.b.metrics.guardedWorkspaceRequestCount.max ? 'PASS' : 'FAIL',
    before: hundred?.b.metrics.guardedWorkspaceRequestCount, after: hundred?.d.metrics.guardedWorkspaceRequestCount });
}
for (const condition of ['cold','warm']) {
  const p = pair('navigation',5000,'constrained','recruiting → applicants',condition), before = p?.b.metrics.meaningfulMs, after = p?.d.metrics.meaningfulMs;
  report.gates.push({ name: '5000 constrained directory ' + condition,
    status: !p ? 'MISSING' : functional(p.b) && functional(p.d) && after.p50 <= before.p50 * .1 && after.p95 <= before.p95 * .1 ? 'PASS' : 'FAIL', before, after, requiredReductionPercent: 90 });
}
for (const size of [1000,5000]) for (const concurrency of [1,2,4])
  latency('capacity ' + size + ' readers-' + concurrency, pair('capacity',size,'local',null,'concurrency-' + concurrency), 'elapsedMs', Infinity,0,.15,0);
report.requiredBrowserUnitsComplete = ['local','constrained'].every(profile => [1,100,1000,5000].every(size => ['navigation','full-review'].every(collector => seen.has([profile,size,collector].join('/')))));
report.functionalClearance = report.comparisons.length > 0 && report.comparisons.every(functional) && report.attempts.filter(a => a.timingEligible).every(a => !(a.functionalFailures || a.failures));
report.performanceClearance = report.requiredBrowserUnitsComplete && report.functionalClearance && report.gates.every(g => g.status === 'PASS');
const qaFile = path.join(root, 'revision-2/attempt-2/HOSTED_QA.json');
const coverageFile = path.join(root, 'revision-2/attempt-2/GATED_COVERAGE.json');
const qa = fs.existsSync(qaFile) ? read(qaFile) : null, coverage = fs.existsSync(coverageFile) ? read(coverageFile) : null;
report.independentFunctionalQAClearance = !!(qa?.allRequiredJobsPassed && qa.candidate === receipt.candidate && qa.applicationDigest === receipt.applicationDigest &&
  coverage?.candidate === receipt.candidate && coverage.applicationDigest === receipt.applicationDigest && coverage.rows?.length === 52 && coverage.rows.every(r => r.status === 'covered_by_separate_passing_integration'));
report.independentFunctionalEvidence = ['attempt-2/HOSTED_QA.json', 'attempt-2/GATED_COVERAGE.json', 'attempt-2/LOCAL_QA.json'];
report.releaseClearance = report.performanceClearance && report.independentFunctionalQAClearance;
report.mergeVerification = 'Application acceptance only; verify final PR head checks, identical application digest and measured-main identity immediately before merge.';
fs.writeFileSync(path.join(root, 'revision-2/BENCHMARKS.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ comparisons: report.comparisons.length, gates: report.gates.map(g => ({name:g.name,status:g.status})), performanceClearance: report.performanceClearance }));
