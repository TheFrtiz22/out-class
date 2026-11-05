const { test } = require('node:test'), assert = require('node:assert/strict');
const { loader } = require('./helpers/communications-loader.cjs');
const { isWriteContention, isDeadlock, retryOnDeadlock } = loader({ '@/utils/prisma': {}, '@/utils/support-audit': {}, '@/utils/admin-elevation': {} })('utils/club-write-transaction.ts');

test('lock waits, transaction timeouts and serialization conflicts are retryable contention', () => {
  for (const error of [
    { code: 'P2028', message: 'Transaction already closed: timeout' },
    { code: 'P2034', message: 'Transaction failed due to a write conflict or a deadlock' },
    { code: 'P2010', meta: { code: '55P03' }, message: 'Raw query failed' },
    { code: 'P2010', meta: { code: '40001' }, message: 'Raw query failed' },
    { code: 'P2010', meta: { code: '40P01' }, message: 'Raw query failed' },
    new Error('canceling statement due to lock timeout'),
  ]) assert.equal(isWriteContention(error), true, JSON.stringify(error.message ?? error));
});

test('validation, authorization and unknown failures are not mistaken for contention', () => {
  for (const error of [null, undefined, 'lock timeout', new Error('This event is full.'), { code: 'P2002', meta: { code: '23505' } }, { code: 'P2025' }, new Error('Sign in required')])
    assert.equal(isWriteContention(error), false);
});

test('only deadlocks are retried, whole, and a bounded number of times', async () => {
  const deadlock = Object.assign(new Error('Raw query failed. Code: `40P01`. deadlock detected'), { code: 'P2010', meta: { code: '40P01' } });
  assert.equal(isDeadlock(deadlock), true);
  for (const error of [null, { code: 'P2010', meta: { code: '55P03' } }, new Error('canceling statement due to lock timeout'), new Error('Only an active owner can grant panel access.')]) assert.equal(isDeadlock(error), false);
  let calls = 0;
  assert.equal(await retryOnDeadlock(async () => { if (++calls < 2) throw deadlock; return 'ok'; }), 'ok');
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(retryOnDeadlock(async () => { calls++; throw deadlock; }), /deadlock/);
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(retryOnDeadlock(async () => { calls++; throw new Error('canceling statement due to lock timeout'); }), /lock timeout/);
  assert.equal(calls, 1);
});
