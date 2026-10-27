// Read-only evidence summarizer. Never starts a browser, Auth service or database.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '..');
const evidenceRoot = 'docs/performance/phase15';
const read = file => JSON.parse(fs.readFileSync(path.join(repo, file), 'utf8'));

function distribution(values) {
  const sorted = values.filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);
  const pick = p => sorted.length ? sorted[Math.ceil(sorted.length * p) - 1] : null;
  return { samples: sorted.length, p50: pick(.5), p95: pick(.95), max: sorted.length ? sorted.at(-1) : null };
}

function assertAcceptedProfile(protocol, host, power) {
  assert.equal(protocol.complete, true, 'Incomplete profile');
  assert.deepEqual(protocol.failures, []);
  assert.equal(protocol.hostControl.valid, true);
  assert.equal(host.valid, true);
  assert.deepEqual(host.violations, []);
  assert.equal(power.acceptedPowerInterval, true);
}

function requestTimings(requests) {
  const groups = new Map();
  for (const request of requests) {
    const key = JSON.stringify([request.route, request.method ?? null, request.type ?? null]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(request);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([key, rows]) => {
    const [route, method, type] = JSON.parse(key);
    const metrics = Object.fromEntries(['startMs', 'endMs', 'ttfbMs', 'transferMs', 'encodedBodyBytes'].map(field => [field, distribution(rows.map(row => row[field]))]));
    const phases = new Map();
    for (const row of rows) for (const [, label, value] of (row.serverTiming ?? '').matchAll(/([a-z_]+);dur=([0-9.]+)/g)) {
      if (!phases.has(label)) phases.set(label, []);
      phases.get(label).push(Number(value));
    }
    return { route, method, type, requests: rows.length, ...metrics,
      serverPhasesMs: Object.fromEntries([...phases].map(([label, values]) => [label, distribution(values)])),
      unknownBodySnapshots: rows.filter(row => row.encodedBodyBytes == null).length,
      failedSnapshots: rows.filter(row => row.failed).length,
      pendingSnapshots: rows.filter(row => row.endMs == null && !row.failed).length };
  });
}

function collectReview() {
  // Verify immutable Phase15 artifacts before deriving any new numbers.
  const sums = fs.readFileSync(path.join(repo, evidenceRoot, 'SHA256SUMS'), 'utf8').trim().split('\n');
  for (const line of sums) {
    const [, digest, file] = line.match(/^([a-f0-9]{64})  (.+)$/) ?? [];
    assert.ok(digest && file, 'Invalid checksum entry');
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, evidenceRoot, file))).digest('hex'), digest, file);
  }
  const groups = new Map(), membership = { browserMeasured: 0, browserWarmups: 0, interactionMeasured: 0, interactionWarmups: 0, nativeMeasured: 0, nativeWarmups: 0 };
  const add = (key, row) => {
    const encoded = JSON.stringify(key);
    if (!groups.has(encoded)) groups.set(encoded, []);
    groups.get(encoded).push(row);
  };
  for (const profile of ['local', 'constrained']) {
    const prefix = `${evidenceRoot}/${profile}`;
    const protocol = read(`${prefix}/PROTOCOL.json`);
    assertAcceptedProfile(protocol, read(`${prefix}/HOST_MONITOR.json`), read(`${prefix}/POWER_AUDIT.json`));
    for (const field of ['completed', 'features']) for (const block of protocol[field]) {
      const match = block.directory.match(/^size-(\d+)-pair-\d+-\d+-([AB])-(?:features-)?(measure|warmup)$/);
      assert.ok(match, block.directory);
      const file = `${prefix}/${block.directory}/browser-samples.json`, data = read(file);
      assert.equal(data.samples.length, block.planned); assert.deepEqual(data.failures, []);
      for (const [index, row] of data.samples.entries()) {
        assert.ok(!row.failed);
        if (match[3] === 'warmup') { membership.browserWarmups++; continue; }
        membership.browserMeasured++;
        add({ category: field === 'features' ? 'feature' : 'main', profile, size: Number(match[1]), variant: match[2], navigation: row.path, condition: row.condition }, { ...row, evidence: { file, index } });
      }
    }
    for (const field of ['interactions', 'concurrency']) for (const block of protocol[field]) {
      const match = block.file.match(/^size-(\d+)-pair-\d+-\d+-([AB])-/); assert.ok(match);
      const file = `${prefix}/${block.file}`, data = read(file);
      assert.equal(data.samples.length, block.planned);
      for (const [index, row] of data.samples.entries()) {
        assert.ok(!row.failed);
        const native = field === 'concurrency';
        if (row.warmup) { membership[native ? 'nativeWarmups' : 'interactionWarmups']++; continue; }
        membership[native ? 'nativeMeasured' : 'interactionMeasured']++;
        add({ category: native ? 'native' : 'interaction', profile, size: Number(match[1]), variant: match[2], navigation: native ? 'pipelinePage initial-list HTTP read' : row.kind, condition: native ? 'native-loopback' : 'warm', ...(native ? { concurrency: row.concurrency } : {}) }, { ...row, meaningfulMs: native ? row.elapsedMs : row.meaningfulMs, evidence: { file, index } });
      }
    }
  }
  assert.deepEqual(membership, { browserMeasured: 512, browserWarmups: 128, interactionMeasured: 160, interactionWarmups: 32, nativeMeasured: 280, nativeWarmups: 56 });
  const records = [...groups].map(([key, rows]) => {
    const group = JSON.parse(key), latency = distribution(rows.map(row => row.meaningfulMs));
    const expected = group.category === 'feature' ? 6 : group.category === 'native' ? 10 * group.concurrency : 10;
    assert.equal(rows.length, expected);
    assert.equal(latency.samples, expected);
    const worst = rows.reduce((a, b) => a.meaningfulMs >= b.meaningfulMs ? a : b);
    return { ...group, environment: group.category === 'native' ? 'Native loopback HTTP; no CDP throttle. Collected after constrained browser blocks.' : group.profile === 'local' ? 'Local production Next build, disposable loopback Auth/PostgreSQL, Chromium1440x1000, unthrottled.' : 'Same local production services; CDP80ms latency,200000B/s down,93750B/s up,CPU4x.',
      buildId: read(`${evidenceRoot}/${group.variant === 'B' ? 'BASELINE' : 'CANDIDATE'}_SOURCE.json`).buildId,
      applicationStatus: group.variant === 'B' ? 'retained baseline' : 'rejected candidate; not retained',
      sampleCount: latency.samples, p50Ms: latency.p50, p95Ms: latency.p95, maxMs: latency.max,
      metrics: Object.fromEntries(['clickToUrlMs', 'interactiveMs', 'networkCompleteMs', 'requestCount', 'encodedBodyBytes', 'scriptMs', 'taskMs', 'layoutMs', 'reactCommitCount'].map(field => [field, distribution(rows.map(row => row[field]))])),
      source: { usefulMs: distribution(rows.map(row => row.preparation?.meaningfulMs)),
        sourcePlusClickMs: distribution(rows.map(row => row.preparation == null ? null : row.preparation.meaningfulMs + row.meaningfulMs)),
        requests: distribution(rows.map(row => row.preparation?.requests?.length)),
        note: 'Source+click is a per-row sum of separate waits; intervening drains/preparation/warm visits are excluded.' },
      relevantRequestTimings: requestTimings(rows.flatMap(row => row.requests ?? (group.category === 'native' ? [{ ...row, route: '/api/workspace?kind=pipelinePage', method: 'GET', type: 'native-http', startMs: row.startOffsetMs, endMs: row.endOffsetMs }] : []))),
      worstSample: worst.evidence, sampleReferences: rows.map(row => row.evidence) };
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  assert.equal(records.length, 92);
  return { reviewDate: '2026-10-27', sourceCommit: 'dd304540aa9a30c64af1b23e21622245c378d98a',
    auditReference: '3017e01d5b55bc8fb38d4f8fbec4906dd93bf619',
    scope: 'Separate Phase15 BA/AB comparison. Never pooled with the October21 audit or earlier phases. Candidate rejected; baseline equals retained Phase13 application.',
    percentileMethod: 'Nearest rank; no interpolation; maxima computed from actual accepted measured rows. Missing metrics have samples0 and null quantiles.',
    limitations: ['Cold browser contexts use warm local Next/Auth/database services, not hosted function cold starts.', 'Feature groups n6 and main groups n10 have p95 equal to the maximum. No statistical significance claimed.', 'Request offsets use existing collector clocks. Server spans may overlap and do not isolate pure pool/lock/provider time.', 'Encoded bytes omit unavailable bodies and headers. All failed/pending snapshots remain in immutable Phase15 artifacts.', 'Native samples within a burst share load; they are not independent browser navigation outcomes.', 'No new performance run was collected for this document update.'],
    membership, records, controls: `${evidenceRoot}/EVIDENCE.json`,
    diagnostics: { acceptedPerformanceData: false, nativeHttp: 168, directIdentity: 56, browser: 32, readOnlyPlans: 4, evidence: `${evidenceRoot}/DIAGNOSTIC_SUMMARY.json` },
    retainedVerification: read(`${evidenceRoot}/FINAL_VERIFICATION.json`),
    rejectedExperimentDecision: `${evidenceRoot}/DECISION.json`,
    transportFlags: `${evidenceRoot}/TRANSPORT_DETAILS.json`, sourceManifest: `${evidenceRoot}/FINAL_SOURCE.json` };
}

if (require.main === module) {
  const file = path.join(repo, 'docs/performance/NAVIGATION_BENCHMARKS.json'), original = JSON.parse(fs.readFileSync(file, 'utf8'));
  original.schemaVersion = 2;
  original.scopeNote = 'Original top-level fields describe only the October21 investigation at sourceCommit. latestReview contains a separate later comparison; do not pool the datasets or treat historical production observations as current telemetry.';
  original.latestReview = collectReview();
  fs.writeFileSync(file, JSON.stringify(original, null, 2) + '\n');
  console.log('Preserved historical benchmark fields; derived92 Phase15 groups with measured n/p50/p95/max and provenance.');
}
module.exports = { distribution, assertAcceptedProfile, collectReview };
