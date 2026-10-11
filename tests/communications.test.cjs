const { test } = require('node:test'), assert = require('node:assert/strict');
const { loader } = require('./helpers/communications-loader.cjs');
const policy = loader({})('lib/communications-policy.ts');
const email = loader({})('lib/notification-email.ts');
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('durable inbox categories preserve announcement filtering and persisted read state', () => {
  const { inboxNotification } = loader({})('lib/communications-client.ts');
  const base = { id: uuid(1), clubId: uuid(2), club: { name: 'Fixture', color: '#142d4e', logoUrl: null }, href: '/?workspace=student&view=inbox', title: 'Update', body: 'Saved body', createdAt: new Date('2026-10-10T12:00:00Z'), readAt: new Date() };
  const items = ['ANNOUNCEMENT', 'APPLICATION', 'TASK', 'INVITATION', 'PLATFORM', 'INTERVIEW'].map(type => inboxNotification({ ...base, type }));
  assert.deepEqual(items.map(n => n.type), ['Announcement', 'Application Update', 'Task', 'Club Invitation', 'OutClass Update', 'Interview Invite']);
  assert.equal(items.filter(n => n.type === 'Announcement').length, 1);
  assert.ok(items.every(n => n.read && n.durableId === base.id && n.body[0] === base.body));
  assert.equal(inboxNotification({ ...base, type: 'ANNOUNCEMENT', readAt: null }).read, false);
});

test('retired direct-message actions reject old clients without accessing live services', async () => {
  const unavailable = () => { throw Error('Retired actions must not access services'); };
  const api = loader({ '@/utils/auth': { requireAuth: unavailable, requireClubPermission: unavailable }, '@/utils/prisma': { prisma: new Proxy({}, { get: unavailable }) } })('actions/communications.ts');
  for (const name of ['findCommunicationRecipients', 'startClubConversation', 'listClubConversations', 'getClubConversation', 'sendClubMessage']) {
    await assert.rejects(api[name](), /Direct messaging is not available/);
  }
});

test('every optional notification category honors its switch, global OFF, and opt-in platform default', () => {
  for (const [type, field] of Object.entries(policy.emailCategory)) {
    assert.equal(policy.optionalEmailAllowed({ ...policy.notificationDefaults, [field]: false }, type), false);
    assert.equal(policy.optionalEmailAllowed({ ...policy.notificationDefaults, [field]: true }, type), true);
    assert.equal(policy.optionalEmailAllowed({ ...policy.notificationDefaults, [field]: true, emailFrequency: 'OFF' }, type), false);
  }
  assert.equal(policy.optionalEmailAllowed(null, 'PLATFORM'), false);
  assert.equal(policy.optionalEmailAllowed(null, 'unknown'), false);
  assert.equal(policy.nextDigestAt(new Date('2026-10-10T23:59:59Z')).toISOString(), '2026-10-11T00:00:00.000Z');
});

test('private conversations require eligibility in the exact club and applicant identification grants', async () => {
  const tx = { club: { findUnique: async () => ({ suspendedAt: null }) }, user: { findFirst: async ({ where }) => { assert.ok(JSON.stringify(where).includes(uuid(1))); return { id: uuid(2) }; } }, clubMember: { findUnique: async ({ where }) => where.userId_clubId.userId === uuid(2) ? null : { status: 'ACTIVE', permissions: ['meetings.manage'] } } };
  await assert.rejects(policy.requireCommunicationAccess(tx, uuid(1), uuid(2), uuid(3)), /current access/);
  tx.clubMember.findUnique = async ({ where }) => where.userId_clubId.userId === uuid(2) ? null : { status: 'ACTIVE', permissions: ['meetings.manage', 'applications.review', 'applicants.identify'] };
  assert.equal(await policy.requireCommunicationAccess(tx, uuid(1), uuid(2), uuid(3)), 'CLUB');
  assert.equal(await policy.requireCommunicationAccess(tx, uuid(1), uuid(2), uuid(2)), 'STUDENT');
  tx.user.findFirst = async () => null;
  await assert.rejects(policy.requireCommunicationAccess(tx, uuid(1), uuid(2), uuid(2)), /current access/);
});

test('owned cursor and runtime read flags fail closed before inbox writes', async () => {
  let writes = 0;
  const api = loader({ '@/utils/auth': { requireAuth: async () => ({ user: { id: uuid(1) } }) }, '@/utils/prisma': { prisma: { userNotification: { findFirst: async ({ where }) => { assert.equal(where.userId, uuid(1)); return null; }, updateMany: async () => { writes++; } } } } })('actions/communications.ts');
  await assert.rejects(api.getDurableNotifications(uuid(2)), /cursor/);
  await assert.rejects(api.setDurableNotificationsRead([uuid(2)], 'false'));
  await assert.rejects(api.setDurableNotificationsArchived([uuid(2)], 'false'));
  assert.equal(writes, 0);
});

test('Resend transport keeps one recipient and a stable key and distinguishes retryable failures', async () => {
  const original = global.fetch, calls = [];
  const payload = email.buildNotificationEmail({ from: 'outclass@virginia.edu', to: 'student@virginia.edu', siteUrl: 'https://outclass.test', digest: false, items: [{ type: 'MESSAGE', title: '<script>secret body</script>', club: { name: '<club>' } }] });
  assert.ok(!payload.html.includes('secret body')); assert.ok(payload.html.includes('&lt;club&gt;'));
  let status = 429;
  global.fetch = async (url, options) => { calls.push({ url, options }); return status === 200 ? Response.json({ id: 'receipt' }) : new Response('', { status, headers: { 'retry-after': '2' } }); };
  try {
    await assert.rejects(email.sendNotificationEmail(payload, uuid(1), 'fixture'), e => e.retryable && e.retryAfterMs === 2000);
    status = 200; assert.deepEqual(await email.sendNotificationEmail(payload, uuid(1), 'fixture'), { id: 'receipt' });
    assert.equal(calls[0].options.headers['Idempotency-Key'], calls[1].options.headers['Idempotency-Key']);
    assert.equal(calls[0].options.body, calls[1].options.body);
    assert.equal(JSON.parse(calls[1].options.body).to, 'student@virginia.edu');
    status = 422; await assert.rejects(email.sendNotificationEmail(payload, uuid(2), 'fixture'), e => !e.retryable);
  } finally { global.fetch = original; }
});

test('worker and real-time endpoints reject unauthenticated requests before accessing the database', async () => {
  const prior = process.env.CRON_SECRET; process.env.CRON_SECRET = 'local-fixture';
  try {
    const worker = loader({ '@/utils/notification-delivery': { processNotificationEmails: () => { throw Error('Must not reach provider'); } } })('app/api/internal/notification-delivery/route.ts');
    assert.equal((await worker.POST(new Request('http://localhost/api/internal/notification-delivery'))).status, 401);
    const stream = loader({ '@/utils/auth': { requireAuth: async () => { throw Error('Denied'); } }, '@/lib/communications-snapshot': { communicationsSnapshot: () => { throw Error('Must not reach DB'); } } })('app/api/communications/stream/route.ts');
    assert.equal((await stream.GET(new Request('http://localhost/api/communications/stream'))).status, 401);
  } finally { if (prior === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = prior; }
});
