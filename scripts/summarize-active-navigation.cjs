// Aggregate sanitized active-room samples, keeping participant and wave counts explicit.
const fs = require('node:fs'), path = require('node:path');
const { distribution } = require('./navigation-audit.cjs');
const root = path.resolve('docs/performance/phase1/active-workload');
const names = { getAssignedInterviewRooms: 'assignedRooms', getInterviewWorkspace: 'interviewWorkspace', getInterviewRounds: 'interviewRounds' };
const kind = r => r.route.includes('?kind=') ? r.route.split('?kind=')[1] : names[r.route.split(':').at(-1)];
const phases = r => Object.fromEntries([...String(r.serverTiming || '').matchAll(/([a-z_]+);dur=([\d.]+)/g)].map(m => [m[1], Number(m[2])]));
const summary = { observationUnit: 'participant navigation, clustered in simultaneous waves', poolSamplingIntervalMs: 50, groups: [], limitations: ['Local warm server/database; cold means a fresh browser context and unvisited destination.', 'One and four users; not a production capacity or sustained-load test.', 'Each reviewer has the same 24 non-overlapping bookings in three owner-attested rooms; published slot-panel versions are not represented.', 'An 8-connection limit applies per Prisma client, not globally to every server process or service.', 'Database sampler observes same-role backends except itself; 50 ms sampling can miss short waits and is not a Prisma queue measurement.', 'DOM readiness plus two animation frames is a paint proxy; four-user observations share browser/CPU and wave.', 'Reference cohorts run before current cohorts; not a randomized crossover.'] };
summary.limitations.push('Browser error counts cover each page lifetime, including initial page load and warm-up; they are not localized to the measured destination click.', 'The raw membersPerClub=61 describes the base fixture; three verified reviewers increase the active club to 64 members.', 'The initial incomplete four-user reference run and two smoke runs are preserved outside the primary groups.');
for (const stage of ['reference', 'current']) for (const clients of [1, 4]) {
  const file = path.join(root, stage + '-' + clients, 'browser-samples.json');
  if (!fs.existsSync(file)) continue;
  const data = JSON.parse(fs.readFileSync(file));
  for (const condition of ['cold', 'warm']) {
    const samples = data.samples.filter(s => s.condition === condition), requests = samples.flatMap(s => s.requests);
    const critical = samples.map(s => {
      const found = new Map();
      for (const r of s.requests) { const key = kind(r); if (['assignedRooms', 'interviewWorkspace', 'interviewRounds'].includes(key) && !found.has(key)) found.set(key, r); }
      return [...found.values()];
    });
    const reads = critical.flat(), phaseNames = [...new Set(reads.flatMap(r => Object.keys(phases(r))))];
    const complete = samples.filter(s => s.requests.every(r => r.type === 'eventsource' || r.encodedBodyBytes !== null));
    const pool = data.poolSamples.filter(s => s.condition === condition);
    const visibleReads = Object.fromEntries(['assignedRooms', 'interviewWorkspace', 'interviewRounds'].map(name => {
      const rows = reads.filter(r => kind(r) === name);
      return [name, { requests: rows.length, durationMs: distribution(rows.map(r => r.endMs - r.startMs)), ttfbMs: distribution(rows.map(r => r.ttfbMs)), serverPhasesMs: Object.fromEntries(phaseNames.map(phase => [phase, distribution(rows.map(r => phases(r)[phase]))])) }];
    }));
    summary.groups.push({ stage, clients, condition, build: data.build, waves: new Set(samples.map(s => s.wave)).size, samples: samples.length, failures: data.failures.filter(f => f.condition === condition), ...Object.fromEntries(['meaningfulMs', 'interactiveMs', 'requestCount', 'networkCompleteMs', 'scriptMs', 'taskMs'].map(metric => [metric, distribution(samples.map(s => s[metric]))])), observedBodyBytesLowerBound: distribution(samples.map(s => s.encodedBodyBytes)), completePayloadSamples: complete.length, completePayloadBytes: distribution(complete.map(s => s.encodedBodyBytes)), httpErrors: requests.filter(r => r.status >= 400).length, transportFailures: requests.filter(r => r.failed).length, post200Aborts: requests.filter(r => r.failed && r.status === 200 && r.failureReason === 'net::ERR_ABORTED').length, failureReasons: Object.fromEntries([...new Set(requests.filter(r => r.failed).map(r => r.failureReason))].map(reason => [reason, requests.filter(r => r.failed && r.failureReason === reason).length])), pageErrors: samples.reduce((n, s) => n + (s.pageErrorCount || 0), 0), visibleReadBarrierMs: distribution(critical.filter(rows => rows.length === 3).map(rows => Math.max(...rows.map(r => r.endMs)) - Math.min(...rows.map(r => r.startMs)))), visibleReadTtfbMs: distribution(reads.map(r => r.ttfbMs)), visibleReads, serverPhasesMs: Object.fromEntries(phaseNames.map(phase => [phase, distribution(reads.map(r => phases(r)[phase]))])), pool: { samples: pool.length, connections: distribution(pool.map(s => s.connections)), active: distribution(pool.map(s => s.active)), idleInTransaction: distribution(pool.map(s => s.idle_in_transaction)), lockWaiting: distribution(pool.map(s => s.lock_waiting)) } });
  }
}
fs.writeFileSync(path.join(root, 'COMPARISON.json'), JSON.stringify(summary, null, 2) + '\n');
for (const g of summary.groups) console.log(`${g.stage} ${g.clients} clients ${g.condition}: ${g.meaningfulMs.p50}/${g.meaningfulMs.p95} ms, ${g.requestCount.p50} requests, ${g.httpErrors} HTTP errors, ${g.post200Aborts} post-200 aborts, ${g.pageErrors} browser errors`);
