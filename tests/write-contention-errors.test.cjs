const { test } = require('node:test'), assert = require('node:assert/strict');
const { loader } = require('./helpers/communications-loader.cjs');
const { isWriteContention } = loader({ '@/utils/prisma': {}, '@/utils/support-audit': {}, '@/utils/admin-elevation': {} })('utils/club-write-transaction.ts');

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
