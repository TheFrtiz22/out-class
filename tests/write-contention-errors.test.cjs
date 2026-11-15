const { test } = require('node:test'), assert = require('node:assert/strict');
const { loader } = require('./helpers/communications-loader.cjs');
const { isWriteContention, isTransactionConflict, retryTransactionConflict, TransactionConflictError, TRANSACTION_CONFLICT_MESSAGE, WRITE_TIMEOUT_MESSAGE, contentionResult, contentionCode } = loader({ '@/utils/prisma': {}, '@/utils/support-audit': {}, '@/utils/admin-elevation': {} })('utils/club-write-transaction.ts');

test('lock waits, transaction timeouts and serialization conflicts are retryable contention', () => {
  for (const error of [
    { code: 'P2028', message: 'Transaction already closed: timeout' },
    { code: 'P2034', message: 'Transaction failed due to a write conflict or a deadlock' },
    { code: 'P2010', meta: { code: '55P03' }, message: 'Raw query failed' },
    { code: 'P2010', meta: { code: '40001' }, message: 'Raw query failed' },
    { code: 'P2010', meta: { code: '40P01' }, message: 'Raw query failed' },
    new Error('canceling statement due to lock timeout'),
    new Error('deadlock detected'),
    new Error('Raw query failed. Code: `40P01`. Message: `ERROR: deadlock detected`'),
  ]) assert.equal(isWriteContention(error), true, JSON.stringify(error.message ?? error));
});

test('validation, authorization and unknown failures are not mistaken for contention', () => {
  for (const error of [null, undefined, 'lock timeout', new Error('This event is full.'), { code: 'P2002', meta: { code: '23505' } }, { code: 'P2025' }, new Error('Sign in required')])
    assert.equal(isWriteContention(error), false);
});

const deadlock = Object.assign(new Error('Raw query failed. Code: `40P01`. deadlock detected'), { code: 'P2010', meta: { code: '40P01' } });
const serialization = Object.assign(new Error('Raw query failed. Code: `40001`. could not serialize access'), { code: 'P2010', meta: { code: '40001' } });
const lockTimeout = Object.assign(new Error('canceling statement due to lock timeout'), { code: 'P2010', meta: { code: '55P03' } });
const statementTimeout = Object.assign(new Error('canceling statement due to statement timeout'), { code: 'P2010', meta: { code: '57014' } });
// Records backoff instead of sleeping; random() fixed so delays are deterministic.
const fast = delays => ({ sleep: async ms => { delays.push(ms); }, random: () => 0.5 });

test('deadlocks and serialization failures are whole-transaction conflicts; timeouts are not', () => {
  for (const error of [deadlock, serialization, { code: 'P2034' }, new Error('deadlock detected'), new Error('could not serialize access due to concurrent update')])
    assert.equal(isTransactionConflict(error), true, error.message);
  for (const error of [null, undefined, lockTimeout, statementTimeout, { code: 'P2028' }, new Error('Only an active owner can grant panel access.'), { code: 'P2002', meta: { code: '23505' } }])
    assert.equal(isTransactionConflict(error), false);
});

test('a conflict on the first attempt re-runs the work once and returns its result', async () => {
  for (const conflict of [deadlock, serialization]) {
    let calls = 0; const delays = [];
    assert.equal(await retryTransactionConflict(async () => { if (++calls === 1) throw conflict; return 'ok'; }, fast(delays)), 'ok');
    assert.equal(calls, 2);
    assert.equal(delays.length, 1);
  }
});

test('lock and statement timeouts and ordinary errors are not retried and pass through unchanged', async () => {
  for (const error of [lockTimeout, statementTimeout, new Error('Panel scope unavailable.')]) {
    let calls = 0; const delays = [];
    await assert.rejects(retryTransactionConflict(async () => { calls++; throw error; }, fast(delays)), thrown => thrown === error);
    assert.equal(calls, 1);
    assert.deepEqual(delays, []);
  }
});

test('retries stop after the attempt limit with backoff and jitter, then report a calm message', async () => {
  let calls = 0; const delays = [];
  await assert.rejects(retryTransactionConflict(async () => { calls++; throw deadlock; }, fast(delays)), thrown => {
    assert.ok(thrown instanceof TransactionConflictError);
    assert.equal(thrown.message, TRANSACTION_CONFLICT_MESSAGE);
    assert.equal(TRANSACTION_CONFLICT_MESSAGE, 'Someone else just changed this. Try again.');
    assert.doesNotMatch(thrown.message, /40P01|deadlock|Raw query|P20/i);
    assert.equal(thrown.cause, deadlock);
    return true;
  });
  assert.equal(calls, 3);
  assert.deepEqual(delays, [25 + 12, 50 + 12]);
  calls = 0;
  await assert.rejects(retryTransactionConflict(async () => { calls++; throw serialization; }, { ...fast([]), attempts: 5 }), TransactionConflictError);
  assert.equal(calls, 5);
});

test('default backoff really waits a short, jittered time between attempts', async () => {
  let calls = 0; const started = Date.now();
  assert.equal(await retryTransactionConflict(async () => { if (++calls < 3) throw deadlock; return 'ok'; }), 'ok');
  assert.equal(calls, 3);
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 70 && elapsed < 1000, `elapsed ${elapsed}ms`);
});

const { unwrapContention, isContentionFailure } = require('./helpers/communications-loader.cjs').loader({})('lib/write-contention.ts');
function captureWarnings(t) {
  const lines = []; const original = console.warn;
  console.warn = (...args) => { lines.push(args.join(' ')); };
  t.after(() => { console.warn = original; });
  return lines;
}

test('exhausted conflicts return the conflict wording and log path and code only', async t => {
  const lines = captureWarnings(t);
  const result = await contentionResult('interview.panel.assignment', () => retryTransactionConflict(async () => { throw deadlock; }, fast([])));
  assert.deepEqual(result, { ok: false, contention: 'conflict', error: TRANSACTION_CONFLICT_MESSAGE });
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), { event: 'write.contention.exhausted', path: 'interview.panel.assignment', kind: 'conflict', code: '40P01' });
  assert.doesNotMatch(lines[0], /deadlock detected|Raw query/);
});

test('timeouts are not retried, get distinct wording, and are logged as timeouts', async t => {
  for (const [error, code] of [[lockTimeout, '55P03'], [{ code: 'P2028', message: 'Transaction already closed: timeout for user 1234' }, 'P2028']]) {
    const lines = captureWarnings(t); let calls = 0;
    const result = await contentionResult('interview.room.panel.approve', () => retryTransactionConflict(async () => { calls++; throw error; }, fast([])));
    assert.equal(calls, 1);
    assert.deepEqual(result, { ok: false, contention: 'timeout', error: WRITE_TIMEOUT_MESSAGE });
    assert.notEqual(WRITE_TIMEOUT_MESSAGE, TRANSACTION_CONFLICT_MESSAGE);
    assert.doesNotMatch(WRITE_TIMEOUT_MESSAGE, /someone else/i);
    assert.deepEqual(JSON.parse(lines.at(-1)), { event: 'write.contention.exhausted', path: 'interview.room.panel.approve', kind: 'timeout', code });
    assert.doesNotMatch(lines.at(-1), /1234/);
  }
});

test('success and ordinary errors pass through contentionResult without logging', async t => {
  const lines = captureWarnings(t);
  assert.deepEqual(await contentionResult('p', async () => ({ assigned: true })), { assigned: true });
  const denied = new Error('Only an active owner can grant panel access.');
  await assert.rejects(contentionResult('p', async () => { throw denied; }), thrown => thrown === denied);
  assert.deepEqual(lines, []);
});

test('logged codes are restricted to Prisma or SQLSTATE codes', () => {
  assert.equal(contentionCode(new TransactionConflictError(serialization)), '40001');
  assert.equal(contentionCode({ code: 'P2034' }), 'P2034');
  assert.equal(contentionCode({ code: 'user@virginia.edu' }), 'unknown');
  assert.equal(contentionCode(new Error('deadlock detected')), 'unknown');
});

test('the client turns a typed contention failure back into an error with its real wording', () => {
  assert.equal(isContentionFailure({ ok: false, contention: 'timeout', error: WRITE_TIMEOUT_MESSAGE }), true);
  assert.equal(isContentionFailure({ assigned: true }), false);
  assert.equal(isContentionFailure({ ok: false, error: 'other' }), false);
  assert.deepEqual(unwrapContention({ unresolved: 0 }), { unresolved: 0 });
  assert.throws(() => unwrapContention({ ok: false, contention: 'conflict', error: TRANSACTION_CONFLICT_MESSAGE }), { message: TRANSACTION_CONFLICT_MESSAGE });
});
