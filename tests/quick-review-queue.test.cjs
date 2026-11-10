const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync('lib/quick-review-queue.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(mod.exports);
const { nextQuickReviewApplicant: next } = mod.exports;

test('fresh selection controls eligibility while the queue controls order', () => {
  const a = { id: 'a', canQuickReview: true }, b = { id: 'b', canQuickReview: true };
  const revoked = { id: 'revoked', canQuickReview: false };
  assert.equal(next(['missing', 'revoked', 'b', 'a'], [a, revoked, b]), b);
  assert.equal(next(['b'], [a]), undefined);
  assert.equal(next([], [a]), undefined);
  assert.equal(next(['revoked'], [revoked]), undefined);
  assert.equal(next(['a'], [{ id: 'a', canQuickReview: false }, a]), undefined);
});

test('large reversed queues avoid nested selection scans', () => {
  let reads = 0;
  const selection = Array.from({ length: 5000 }, (_, i) => ({
    get id() { reads++; return String(i); }, canQuickReview: i === 0,
  }));
  const queue = Array.from({ length: 5000 }, (_, i) => String(4999 - i));
  assert.equal(next(queue, selection), selection[0]);
  assert.ok(reads <= 5000, `expected linear indexing, observed ${reads} ID reads`);
  assert.equal(queue.length, 5000);
  assert.equal(selection.length, 5000);
});
