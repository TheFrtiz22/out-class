const { test } = require('node:test');
const assert = require('node:assert/strict');
const { distribution, assertAcceptedProfile, collectReview } = require('../scripts/summarize-navigation-review.cjs');

test('summary preserves zero, missing metrics and the actual slow maximum', () => {
  assert.deepEqual(distribution([null, undefined, 0, 9, 2, NaN]), { samples: 3, p50: 2, p95: 9, max: 9 });
  assert.deepEqual(distribution([]), { samples: 0, p50: null, p95: null, max: null });
  assert.equal(distribution([...Array(19).fill(1), 99]).p95, 1);
  assert.equal(distribution([...Array(19).fill(1), 99]).max, 99);
});

test('incomplete, host-invalid or sleep-interrupted profiles cannot be summarized', () => {
  const protocol = { complete: true, failures: [], hostControl: { valid: true } };
  const host = { valid: true, violations: [] }, power = { acceptedPowerInterval: true };
  assert.doesNotThrow(() => assertAcceptedProfile(protocol, host, power));
  assert.throws(() => assertAcceptedProfile({ ...protocol, complete: false }, host, power));
  assert.throws(() => assertAcceptedProfile(protocol, { ...host, violations: ['foreign build'] }, power));
  assert.throws(() => assertAcceptedProfile(protocol, host, { acceptedPowerInterval: false }));
});

test('real immutable evidence retains every measured row and the rejected cold tail', () => {
  const result = collectReview();
  assert.equal(result.records.length, 92);
  assert.equal(result.membership.browserMeasured, 512);
  const cold = result.records.find(row => row.category === 'feature' && row.profile === 'constrained' && row.variant === 'A' && row.navigation === 'settingsApplication → rounds' && row.condition === 'cold');
  assert.equal(cold.sampleCount, 6);
  assert.equal(cold.p50Ms, 465);
  assert.ok(Math.abs(cold.maxMs - 1463.2) < .001);
  assert.equal(cold.worstSample.index, 19);
  assert.equal(cold.applicationStatus, 'rejected candidate; not retained');
  const native = result.records.find(row => row.category === 'native' && row.size === 5000 && row.variant === 'B' && row.concurrency === 4);
  assert.equal(native.sampleCount, 40);
  assert.ok(native.maxMs >= native.p95Ms);
  assert.equal(result.diagnostics.acceptedPerformanceData, false);
});
