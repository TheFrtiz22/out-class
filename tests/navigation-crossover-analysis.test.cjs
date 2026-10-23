const { test } = require('node:test'), assert = require('node:assert/strict');
const { pairedBootstrap, summarize } = require('../scripts/summarize-navigation-crossover.cjs');
test('paired uncertainty retains participant clusters and the direction of a known constant effect', () => {
  const pairs = Array.from({ length: 4 }, (_, pair) => ({ A: [[21 + pair, 22 + pair, 23 + pair, 24 + pair], [31 + pair, 32 + pair, 33 + pair, 34 + pair]], B: [[11 + pair, 12 + pair, 13 + pair, 14 + pair], [21 + pair, 22 + pair, 23 + pair, 24 + pair]] }));
  const interval = pairedBootstrap(pairs, 'fixture', 500);
  assert.deepEqual(interval.p50DeltaMs, { low: 10, high: 10 });
  assert.deepEqual(interval.p95DeltaMs, { low: 10, high: 10 });
  assert.deepEqual(pairedBootstrap(pairs.map(p => ({ A: p.B, B: p.A })), 'fixture', 500).p95DeltaMs, { low: -10, high: -10 });
  assert.deepEqual(pairedBootstrap(pairs.map(p => ({ A: p.A, B: p.A })), 'fixture', 500).p50DeltaMs, { low: 0, high: 0 });
});
test('comparison summaries retain errors and incomplete payloads without trimming latency observations', () => {
  const rows = [1, 2, 3, 1000].map((meaningfulMs, index) => ({ meaningfulMs, pageErrorCount: index === 3 ? 1 : 0, renderedRooms: 24, openInterviewLinks: 24, requests: [{ route: '/api/workspace?kind=assignedRooms', status: index === 3 ? 503 : 200, failed: index === 3, encodedBodyBytes: index === 3 ? null : 10, serverTiming: 'identity;dur=3, database;dur=4, total;dur=8', ttfbMs: 9 }] }));
  const result = summarize(rows); assert.equal(result.meaningfulMs.samples, 4); assert.equal(result.meaningfulMs.p95, 1000);
  assert.equal(result.browserErrors, 1); assert.equal(result.httpErrors, 1); assert.equal(result.transportFailures, 1); assert.equal(result.completePayloadObservations, 3);
  assert.equal(result.assignedRoomPhasesMs.total.p50, 8);
});
