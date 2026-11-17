// Notification email worker isolation on disposable native PostgreSQL: real Prisma,
// outbox triggers, locks and constraints. Only the Resend HTTP call is stubbed.
// Run: node scripts/test-decision-publication-local.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { PrismaClient } = require('@prisma/client');

const databaseUrl = process.env.OUTCLASS_AUDIENCE_TEST_DATABASE_URL;

function loader(mocks) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts') : name.startsWith('.') ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name), mod, mod.exports);
    return mod.exports;
  }
  return load;
}

test('one bad notification or suspended club cannot stop other recipients\' email', { skip: !databaseUrl, timeout: 180000 }, async t => {
  const url = new URL(databaseUrl);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '58453'); assert.equal(url.pathname, '/outclass_audiences_test');
  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  t.after(() => db.$disconnect());
  const env = { COMMUNICATIONS_EMAIL_ENABLED: 'true', RESEND_API_KEY: 'test-only', RESEND_FROM_EMAIL: 'updates@out-class.net', OUTCLASS_SITE_URL: 'https://out-class.net' };
  const saved = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]));
  Object.assign(process.env, env);
  const realFetch = globalThis.fetch, sentTo = [];
  let quotaExceeded = false;
  globalThis.fetch = async (target, init) => {
    assert.equal(String(target), 'https://api.resend.com/emails');
    sentTo.push(JSON.parse(init.body).to);
    if (quotaExceeded) return new Response(JSON.stringify({ statusCode: 429, name: 'daily_quota_exceeded', message: 'You have exceeded your daily email sending quota.' }), { status: 429, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ id: `resend-${randomUUID()}` }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = realFetch; for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v; });
  const worker = loader({ '@/utils/prisma': { prisma: db } })('utils/notification-delivery.ts');

  // Start from an empty outbox so earlier suites in this database don't interfere.
  await db.notificationEmailOutbox.updateMany({ where: { status: 'PENDING' }, data: { status: 'SUPPRESSED' } });
  await db.notificationEmailDelivery.updateMany({ where: { status: { in: ['QUEUED', 'SENDING'] } }, data: { status: 'SUPPRESSED' } });

  const club = async suspended => db.club.create({ data: { slug: `worker-${randomUUID()}`, name: 'Worker Club', tagline: '', description: '', color: '#142d4e', category: 'Academic', suspendedAt: suspended ? new Date() : null } });
  const user = async () => db.user.create({ data: { email: `${randomUUID()}@virginia.edu` } });
  let order = 0;
  const notify = async (userId, clubId, extra = {}) => {
    const n = await db.userNotification.create({ data: { userId, clubId, eventKey: `test:${randomUUID()}`, type: 'ANNOUNCEMENT', title: 'Update', body: 'Body', href: '/?workspace=student&view=inbox', ...extra } });
    // Deterministic queue order: the outbox row's createdAt drives which users are picked first.
    await db.notificationEmailOutbox.update({ where: { notificationId: n.id }, data: { createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, order++)) } });
    return n;
  };
  const outbox = id => db.notificationEmailOutbox.findUniqueOrThrow({ where: { notificationId: id } });

  await t.test('suspended-club rows no longer fill the batch head and starve healthy recipients', async () => {
    const suspended = await club(true), healthy = await club(false);
    const blocked = [];
    for (let i = 0; i < 12; i++) blocked.push(await notify((await user()).id, suspended.id));
    const recipient = await user(), healthyRow = await notify(recipient.id, healthy.id);
    sentTo.length = 0;
    const result = await worker.processNotificationEmails(10);
    assert.deepEqual(sentTo, [recipient.email]);
    assert.equal(result.sent, 1);
    assert.equal((await outbox(healthyRow.id)).status, 'ASSIGNED');
    for (const row of blocked) assert.equal((await outbox(row.id)).status, 'PENDING', 'suspended-club email is retained until restoration');
    await db.club.update({ where: { id: suspended.id }, data: { suspendedAt: null } });
    await worker.processNotificationEmails(25);
    assert.equal((await outbox(blocked[0].id)).status, 'ASSIGNED', 'restored club email is delivered');
  });

  await t.test('a drained run sends a large decision batch in one cron run; a single pass stays bounded', async () => {
    const c = await club(false), rows = [];
    for (let i = 0; i < 40; i++) rows.push(await notify((await user()).id, c.id));
    const savedRate = process.env.RESEND_MAX_REQUESTS_PER_SECOND;
    process.env.RESEND_MAX_REQUESTS_PER_SECOND = '50';
    try {
      sentTo.length = 0;
      const single = await worker.processNotificationEmails(10);
      assert.equal(single.sent, 10, 'one pass sends at most the batch size');
      const drained = await worker.processNotificationEmails(25, { drain: true });
      assert.equal(drained.sent, 30, 'the drained run sends everything that is left');
      assert.equal(sentTo.length, 40);
      for (const row of rows) assert.equal((await outbox(row.id)).status, 'ASSIGNED');
      const again = await worker.processNotificationEmails(25, { drain: true });
      assert.deepEqual([again.sent, again.failed], [0, 0], 'an empty queue ends after one pass');
    } finally {
      if (savedRate === undefined) delete process.env.RESEND_MAX_REQUESTS_PER_SECOND; else process.env.RESEND_MAX_REQUESTS_PER_SECOND = savedRate;
    }
  });

  await t.test('a tiny configured send rate is clamped, so no claimed delivery waits out its lease', async () => {
    const c = await club(false), rows = [];
    for (let i = 0; i < 3; i++) rows.push(await notify((await user()).id, c.id));
    const savedRate = process.env.RESEND_MAX_REQUESTS_PER_SECOND;
    process.env.RESEND_MAX_REQUESTS_PER_SECOND = '0.01';
    try {
      sentTo.length = 0;
      const begun = Date.now();
      const result = await worker.processNotificationEmails(10);
      assert.equal(result.sent, 3);
      assert.ok(Date.now() - begun < 10000, 'three sends at the 1/s floor take seconds, not minutes');
      assert.equal(await db.notificationEmailDelivery.count({ where: { status: 'SENDING' } }), 0, 'nothing is left mid-send');
    } finally {
      if (savedRate === undefined) delete process.env.RESEND_MAX_REQUESTS_PER_SECOND; else process.env.RESEND_MAX_REQUESTS_PER_SECOND = savedRate;
    }
  });

  await t.test('an undeliverable notification is suppressed alone; the rest of the queue is delivered', async () => {
    const c = await club(false), poisoned = await user(), next = await user();
    // A DECISION notification whose link is not a canonical decision path cannot become an email.
    const bad = await notify(poisoned.id, c.id, { type: 'DECISION', href: '/not-a-decision-link' });
    const good = await notify(next.id, c.id);
    sentTo.length = 0;
    const result = await worker.processNotificationEmails(10);
    assert.deepEqual(sentTo, [next.email]);
    assert.equal(result.invalid, 1);
    assert.equal((await outbox(bad.id)).status, 'SUPPRESSED');
    assert.equal((await outbox(good.id)).status, 'ASSIGNED');
    assert.ok(await db.userNotification.findUnique({ where: { id: bad.id } }), 'the in-app notification is kept');
  });

  await t.test('a stored delivery with an invalid payload fails alone; later deliveries still send', async () => {
    const recipient = await user(), other = await user();
    const broken = await db.notificationEmailDelivery.create({ data: { userId: recipient.id, payload: { to: 'not-an-email' }, createdAt: new Date(Date.UTC(2025, 0, 1)) } });
    const c = await club(false), good = await notify(other.id, c.id);
    sentTo.length = 0;
    const result = await worker.processNotificationEmails(10);
    assert.deepEqual(sentTo, [other.email]);
    assert.equal(result.invalid, 1);
    const failed = await db.notificationEmailDelivery.findUniqueOrThrow({ where: { id: broken.id } });
    assert.deepEqual([failed.status, failed.failureCode], ['FAILED', 'INVALID_PAYLOAD']);
    assert.equal((await outbox(good.id)).status, 'ASSIGNED');
  });

  await t.test('a daily sending quota pauses the run and keeps every delivery\'s retry budget for the reset', async () => {
    const c = await club(false), recipients = [];
    for (let i = 0; i < 3; i++) { const u = await user(); recipients.push(u); await notify(u.id, c.id); }
    const savedRate = process.env.RESEND_MAX_REQUESTS_PER_SECOND;
    process.env.RESEND_MAX_REQUESTS_PER_SECOND = '50';
    try {
      quotaExceeded = true; sentTo.length = 0;
      const refused = await worker.processNotificationEmails(10, { drain: true });
      assert.equal(sentTo.length, 1, 'the run stops at the first quota refusal instead of trying every delivery');
      assert.deepEqual([refused.sent, refused.failed], [0, 1]);
      const rows = await db.notificationEmailDelivery.findMany({ where: { userId: { in: recipients.map(u => u.id) } } });
      assert.equal(rows.length, 3);
      for (const row of rows) assert.deepEqual([row.status, row.attemptCount, row.firstAttemptAt], ['QUEUED', 0, null], 'a refused or untried delivery keeps its whole retry budget');
      const held = rows.find(row => row.failureCode === 'RESEND_DAILY_QUOTA');
      assert.ok(held, 'the refused delivery records why it is waiting');
      const midnight = new Date(); midnight.setUTCHours(24, 0, 0, 0);
      assert.ok(+held.nextAttemptAt >= +midnight, 'it waits for the quota to reset at midnight UTC');
      quotaExceeded = false; sentTo.length = 0;
      await db.notificationEmailDelivery.updateMany({ where: { id: { in: rows.map(row => row.id) } }, data: { nextAttemptAt: new Date() } });
      const resumed = await worker.processNotificationEmails(10, { drain: true });
      assert.equal(resumed.sent, 3, 'after the reset every held delivery sends');
      assert.deepEqual(sentTo.sort(), recipients.map(u => u.email).sort());
    } finally {
      quotaExceeded = false;
      if (savedRate === undefined) delete process.env.RESEND_MAX_REQUESTS_PER_SECOND; else process.env.RESEND_MAX_REQUESTS_PER_SECOND = savedRate;
    }
  });
});
