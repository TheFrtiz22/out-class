const { test } = require('node:test'), assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const { Actor, readConfig, randomUUID } = require('./helpers/onboarding-e2e.cjs');
const { loader } = require('./helpers/communications-loader.cjs');
const configFile = process.env.OUTCLASS_COMMUNICATIONS_E2E_CONFIG;

test('Communications Center over real Next HTTP, verified Supabase Auth and local PostgreSQL', { skip: !configFile, timeout: 180000 }, async t => {
  const config = readConfig(configFile), db = new PrismaClient({ datasourceUrl: config.status.DB_URL });
  t.after(() => db.$disconnect());
  const authAdmin = createClient(config.status.API_URL, config.status.SECRET_KEY, { auth: { persistSession: false } });
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8), password = 'Local-only!' + randomUUID();
  const actors = {}, users = {};
  for (const role of ['owner', 'foreign', 'member', 'applicant', 'anonymous', 'outsider', 'draft', 'limited']) {
    const email = `${role}${suffix}@virginia.edu`;
    const result = await authAdmin.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error) throw result.error;
    users[role] = await db.user.upsert({ where: { id: result.data.user.id }, create: { id: result.data.user.id, email }, update: {} });
    await db.studentProfile.create({ data: { userId: users[role].id, computingId: role + suffix, firstName: role, lastName: 'Fixture', major: 'Economics', gradYear: 2028 } });
    const actor = new Actor(config); await actor.signIn(email, password); actors[role] = actor;
  }
  const club = await db.club.create({ data: { slug: 'communication-' + suffix, name: 'Communication Society', tagline: '', description: '', color: '#142d45', category: 'Academic' } });
  const foreign = await db.club.create({ data: { slug: 'foreign-' + suffix, name: 'Another Society', tagline: '', description: '', color: '#142d45', category: 'Academic' } });
  for (const [role, clubId, owner, permissions] of [['owner', club.id, true, []], ['foreign', foreign.id, true, []], ['member', club.id, false, []], ['limited', club.id, false, ['meetings.manage']]]) {
    await db.clubMember.create({ data: { userId: users[role].id, clubId, isOwner: owner, accessRole: owner ? 'OWNER' : 'MEMBER', permissions } });
  }
  const round = await db.pipelineRound.create({ data: { clubId: club.id, name: 'Review', order: 0 } });
  const anonRound = await db.pipelineRound.create({ data: { clubId: club.id, name: 'Anonymous', order: 1, anonymousReview: true } });
  for (const role of ['applicant', 'anonymous', 'draft']) await db.application.create({ data: { clubId: club.id, studentId: users[role].id, roundId: role === 'anonymous' ? anonRound.id : round.id, status: role === 'draft' ? 'DRAFTING' : 'SUBMITTED', submittedAt: role === 'draft' ? null : new Date() } });
  const call = (actor, name, ...args) => actor.action('actions/communications.ts', name, args);
  let conversation, message;
  const completed = new Set();
  async function scenario(name, fn) { await t.test(name, async () => { await fn(); completed.add(name); }); assert.ok(completed.has(name), 'Stop dependent scenarios after ' + name + ' failed'); }

  await scenario('club isolation, recipient filtering, anonymous review and forged identities fail closed', async () => {
    const anonymous = new Actor(config);
    await assert.rejects(call(anonymous, 'getDurableNotifications'));
    for (const role of ['foreign', 'member', 'outsider']) await assert.rejects(call(actors[role], 'getClubAnnouncements', club.id));
    const results = await call(actors.owner, 'findCommunicationRecipients', club.id, suffix);
    assert.ok(results.some(row => row.id === users.applicant.id));
    for (const role of ['anonymous', 'outsider', 'draft', 'foreign']) assert.ok(!results.some(row => row.id === users[role].id), role);
    const limited = await call(actors.limited, 'findCommunicationRecipients', club.id, suffix);
    assert.ok(!limited.some(row => row.id === users.applicant.id));
    for (const role of ['outsider', 'draft', 'anonymous']) await assert.rejects(call(actors.owner, 'startClubConversation', { clubId: club.id, studentId: users[role].id, subject: 'Private' }));
    await assert.rejects(call(actors.limited, 'startClubConversation', { clubId: club.id, studentId: users.applicant.id, subject: 'Private' }));
    await assert.rejects(call(actors.applicant, 'startClubConversation', { clubId: club.id, studentId: users.member.id, subject: 'Forged recipient' }));
    const searchParams = new URLSearchParams(); searchParams.set('kind', 'unknown');
    const browserRead = await fetch(config.status.API_URL + '/rest/v1/ClubConversation?select=*', { headers: { apikey: config.status.PUBLISHABLE_KEY, authorization: 'Bearer ' + (await actors.owner.client.auth.getSession()).data.session.access_token } });
    assert.ok(browserRead.status === 401 || browserRead.status === 403, 'Browser database roles cannot read private tables');
  });

  await scenario('publication retries create exactly one announcement and recipient snapshot with atomic email intent', async () => {
    const input = { clubId: club.id, title: 'Welcome', body: 'Meeting details stay in OutClass.', audience: 'MEMBERS', requestKey: randomUUID() };
    const published = await Promise.all([call(actors.owner, 'publishClubAnnouncement', input), call(actors.owner, 'publishClubAnnouncement', input)]);
    assert.equal(published[0].id, published[1].id); assert.equal(published[0].recipientCount, 3);
    assert.equal(await db.clubAnnouncement.count({ where: { clubId: club.id } }), 1);
    const rows = await db.userNotification.findMany({ where: { announcementId: published[0].id }, include: { emailOutbox: true } });
    assert.equal(rows.length, 3); assert.ok(rows.every(row => row.emailOutbox?.status === 'PENDING'));
    assert.ok(!rows.some(row => row.userId === users.foreign.id));
    await assert.rejects(call(actors.owner, 'publishClubAnnouncement', { ...input, body: 'Different request' }));
  });

  await scenario('private replies are durable, idempotent, scoped to the authorized team and stripped of sender identity', async () => {
    conversation = await call(actors.applicant, 'startClubConversation', { clubId: club.id, subject: 'A question about the club' });
    const input = { conversationId: conversation.id, body: 'Private question from applicant', requestKey: randomUUID() };
    const posted = await Promise.all([call(actors.applicant, 'sendClubMessage', input), call(actors.applicant, 'sendClubMessage', input)]);
    assert.equal(posted[0].id, posted[1].id); message = posted[0];
    assert.equal(await db.clubMessage.count({ where: { conversationId: conversation.id } }), 1);
    for (const role of ['foreign', 'limited', 'outsider', 'member']) await assert.rejects(call(actors[role], 'getClubConversation', conversation.id));
    const ownerThread = await call(actors.owner, 'getClubConversation', conversation.id);
    assert.equal(ownerThread.items[0].body, input.body); assert.ok(!JSON.stringify(ownerThread).includes(users.applicant.id));
    const ownerInbox = await call(actors.owner, 'getDurableNotifications');
    const received = ownerInbox.items.find(item => item.eventKey === 'message:' + message.id);
    assert.ok(received); assert.ok(!received.body.includes('Private question'));
    assert.ok(!(await call(actors.limited, 'getDurableNotifications')).items.some(item => item.eventKey === 'message:' + message.id));
    await call(actors.owner, 'sendClubMessage', { conversationId: conversation.id, body: 'Private answer from club team', requestKey: randomUUID() });
    assert.equal((await call(actors.applicant, 'getClubConversation', conversation.id)).items.length, 2);
    await assert.rejects(call(actors.owner, 'sendClubMessage', { ...input, senderId: users.foreign.id }));
  });

  await scenario('inbox pagination, read/archive state and preferences belong only to the signed-in user', async () => {
    await db.userNotification.createMany({ data: Array.from({ length: 55 }, (_, i) => ({ userId: users.member.id, clubId: club.id, eventKey: 'pagination:' + randomUUID(), type: 'PLATFORM', title: 'Update ' + i, body: 'Saved update', href: '/?workspace=student&view=inbox', createdAt: new Date(Date.now() + i) })) });
    const first = await call(actors.member, 'getDurableNotifications'), second = await call(actors.member, 'getDurableNotifications', first.nextCursor);
    assert.equal(first.items.length, 50); assert.ok(second.items.length > 0);
    assert.equal(new Set([...first.items, ...second.items].map(row => row.id)).size, first.items.length + second.items.length);
    await assert.rejects(call(actors.foreign, 'getDurableNotifications', first.nextCursor));
    assert.equal((await call(actors.foreign, 'setDurableNotificationsRead', [first.items[0].id], true)).updated, 0);
    await call(actors.member, 'setDurableNotificationsRead', [first.items[0].id], true);
    assert.ok((await db.userNotification.findUnique({ where: { id: first.items[0].id } })).readAt);
    await call(actors.member, 'setDurableNotificationsArchived', [first.items[0].id], true);
    assert.ok(!(await call(actors.member, 'getDurableNotifications')).items.some(row => row.id === first.items[0].id));
    await call(actors.member, 'setDurableNotificationsArchived', [first.items[0].id], false);
    const preference = { emailAnnouncements: false, emailMessages: false, emailApplications: false, emailInterviews: false, emailInvitations: false, emailTasks: false, emailPlatform: false, emailFrequency: 'OFF' };
    await call(actors.member, 'saveNotificationPreferences', preference);
    assert.equal((await call(actors.member, 'getNotificationPreferences')).emailFrequency, 'OFF');
    assert.equal((await call(actors.foreign, 'getNotificationPreferences')).emailFrequency, 'INSTANT');
    await assert.rejects(call(actors.member, 'saveNotificationPreferences', { ...preference, userId: users.foreign.id }));
  });

  await scenario('authenticated stream updates after publication, read changes and account disablement', async () => {
    const abort = new AbortController();
    const response = await actors.member.request('/api/communications/stream', { signal: abort.signal });
    assert.equal(response.status, 200); assert.ok(response.headers.get('content-type').includes('text/event-stream'));
    const reader = response.body.getReader(), decoder = new TextDecoder();
    async function event(expected = 'communications') {
      const timeout = setTimeout(() => abort.abort(), 10000);
      try { let text = ''; while (!text.includes('event: ' + expected)) { const next = await reader.read(); if (next.done) throw Error('Stream closed early'); text += decoder.decode(next.value); } return text; } finally { clearTimeout(timeout); }
    }
    const first = await event();
    await call(actors.owner, 'publishClubAnnouncement', { clubId: club.id, title: 'Live update', body: 'A live inbox event', audience: 'MEMBERS', requestKey: randomUUID() });
    const next = await event(); assert.notEqual(first, next); assert.ok(!next.includes('Live update'));
    const notification = (await call(actors.member, 'getDurableNotifications')).items.find(row => row.title === 'Live update');
    await call(actors.member, 'setDurableNotificationsRead', [notification.id], true); assert.notEqual(next, await event());
    await db.user.update({ where: { id: users.member.id }, data: { disabledAt: new Date() } });
    await event('unavailable'); abort.abort();
    await db.user.update({ where: { id: users.member.id }, data: { disabledAt: null } });
  });

  await scenario('revoked membership, anonymous review and club suspension stop conversation access', async () => {
    await db.pipelineRound.update({ where: { id: round.id }, data: { anonymousReview: true } });
    await assert.rejects(call(actors.owner, 'getClubConversation', conversation.id));
    await assert.rejects(call(actors.applicant, 'sendClubMessage', { conversationId: conversation.id, body: 'Unavailable', requestKey: randomUUID() }));
    assert.ok(!(await call(actors.owner, 'listClubConversations', club.id)).some(row => row.id === conversation.id));
    await db.pipelineRound.update({ where: { id: round.id }, data: { anonymousReview: false } });
    await db.club.update({ where: { id: club.id }, data: { suspendedAt: new Date() } });
    await assert.rejects(call(actors.owner, 'getClubConversation', conversation.id));
    await db.club.update({ where: { id: club.id }, data: { suspendedAt: null } });
    await db.clubMember.update({ where: { userId_clubId: { userId: users.owner.id, clubId: club.id } }, data: { status: 'LEFT' } });
    await assert.rejects(call(actors.owner, 'getClubConversation', conversation.id));
    await db.clubMember.update({ where: { userId_clubId: { userId: users.owner.id, clubId: club.id } }, data: { status: 'ACTIVE' } });
  });

  await scenario('durable queue survives provider failures, concurrent workers, stale leases and preference changes without real email', async () => {
    const http = require('node:http'); const requests = [], accepted = new Map(); let mode = 'success';
    const server = http.createServer(async (req, res) => {
      let body = ''; for await (const chunk of req) body += chunk;
      const key = req.headers['idempotency-key']; requests.push({ key, body });
      if (mode === 'retry') { res.writeHead(429, { 'retry-after': '0' }); res.end('{}'); return; }
      if (mode === 'reject') { res.writeHead(422); res.end('{}'); return; }
      if (accepted.has(key)) assert.equal(accepted.get(key).body, body, 'Idempotent retry uses the exact payload');
      else accepted.set(key, { id: randomUUID(), body });
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ id: accepted.get(key).id }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const originalFetch = global.fetch, saved = Object.fromEntries(['COMMUNICATIONS_EMAIL_ENABLED', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'OUTCLASS_SITE_URL'].map(key => [key, process.env[key]]));
    Object.assign(process.env, { COMMUNICATIONS_EMAIL_ENABLED: 'true', RESEND_API_KEY: 'local-fixture', RESEND_FROM_EMAIL: 'fixture@virginia.edu', OUTCLASS_SITE_URL: config.appUrl });
    global.fetch = (url, options) => { assert.equal(url, 'https://api.resend.com/emails', 'Worker only calls the intercepted provider'); return originalFetch(`http://127.0.0.1:${server.address().port}/emails`, options); };
    const worker = loader({ '@/utils/prisma': { prisma: db } })('utils/notification-delivery.ts');
    const preference = { emailAnnouncements: true, emailMessages: true, emailApplications: true, emailInterviews: true, emailInvitations: true, emailTasks: true, emailPlatform: true, emailFrequency: 'INSTANT' };
    const notification = (type = 'ANNOUNCEMENT') => db.userNotification.create({ data: { userId: users.member.id, clubId: club.id, eventKey: 'queue-test:' + randomUUID(), type, title: 'Queue fixture', body: 'Never included in provider payload', href: '/?workspace=student&view=inbox' } });
    async function quiesce() { await db.notificationEmailOutbox.updateMany({ where: { status: 'PENDING' }, data: { status: 'SUPPRESSED' } }); await db.notificationEmailDelivery.updateMany({ where: { status: { in: ['QUEUED', 'SENDING'] } }, data: { status: 'SUPPRESSED' } }); }
    try {
      await quiesce(); await db.userNotificationPreference.update({ where: { userId: users.member.id }, data: preference });
      const first = await notification(); mode = 'retry'; await worker.processNotificationEmails(25);
      const item = await db.notificationEmailOutbox.findUnique({ where: { notificationId: first.id }, include: { delivery: true } });
      assert.equal(item.delivery.status, 'QUEUED'); assert.equal(item.delivery.attemptCount, 1); assert.ok(item.delivery.nextAttemptAt > new Date());
      await db.notificationEmailDelivery.update({ where: { id: item.deliveryId }, data: { nextAttemptAt: new Date(0) } }); mode = 'success';
      await Promise.all([worker.processNotificationEmails(25), worker.processNotificationEmails(25)]);
      assert.equal(accepted.size, 1); const sent = await db.notificationEmailDelivery.findUnique({ where: { id: item.deliveryId } }); assert.equal(sent.status, 'SENT'); assert.equal(sent.attemptCount, 2);
      await db.notificationEmailDelivery.update({ where: { id: sent.id }, data: { status: 'SENDING', leaseUntil: new Date(0), leaseToken: randomUUID() } });
      await worker.processNotificationEmails(25); assert.equal(accepted.size, 1);
      const beforeExpiry = requests.length;
      await db.notificationEmailDelivery.update({ where: { id: sent.id }, data: { status: 'SENDING', leaseUntil: new Date(0), firstAttemptAt: new Date(Date.now() - 24 * 3600000) } });
      await worker.processNotificationEmails(25); assert.equal(requests.length, beforeExpiry); assert.equal((await db.notificationEmailDelivery.findUnique({ where: { id: sent.id } })).status, 'UNCERTAIN');
      const suppressed = await notification(); mode = 'retry'; await worker.processNotificationEmails(25);
      const suppressedItem = await db.notificationEmailOutbox.findUnique({ where: { notificationId: suppressed.id } });
      await db.notificationEmailDelivery.update({ where: { id: suppressedItem.deliveryId }, data: { nextAttemptAt: new Date(0) } });
      await db.userNotificationPreference.update({ where: { userId: users.member.id }, data: { emailAnnouncements: false } }); mode = 'success';
      const beforeOptOut = requests.length; await worker.processNotificationEmails(25); assert.equal(requests.length, beforeOptOut);
      assert.equal((await db.notificationEmailDelivery.findUnique({ where: { id: suppressedItem.deliveryId } })).status, 'SUPPRESSED');
      assert.ok(await db.userNotification.findUnique({ where: { id: suppressed.id } }), 'Email opt-out preserves in-app notification');
      await db.userNotificationPreference.update({ where: { userId: users.member.id }, data: { ...preference, emailFrequency: 'DAILY' } });
      const daily = await Promise.all([notification('TASK'), notification('APPLICATION')]); const beforeDaily = requests.length;
      await worker.processNotificationEmails(25); assert.equal(requests.length, beforeDaily);
      await db.notificationEmailOutbox.updateMany({ where: { notificationId: { in: daily.map(row => row.id) } }, data: { createdAt: new Date(Date.now() - 86400000) } });
      await worker.processNotificationEmails(25);
      const digestItems = await db.notificationEmailOutbox.findMany({ where: { notificationId: { in: daily.map(row => row.id) } }, include: { delivery: true } });
      assert.equal(digestItems[0].deliveryId, digestItems[1].deliveryId); assert.equal(digestItems[0].delivery.status, 'SENT'); assert.equal(requests.length, beforeDaily + 1);
      assert.ok(JSON.parse(requests.at(-1).body).subject.includes('daily'));
      await db.userNotificationPreference.update({ where: { userId: users.member.id }, data: preference });
      const permanent = await notification(); mode = 'reject'; await worker.processNotificationEmails(25);
      const permanentItem = await db.notificationEmailOutbox.findUnique({ where: { notificationId: permanent.id }, include: { delivery: true } }); assert.equal(permanentItem.delivery.status, 'FAILED');
      assert.ok(requests.every(row => !row.body.includes('Never included')));
      await quiesce(); process.env.COMMUNICATIONS_EMAIL_ENABLED = 'false'; await notification(); const beforeDisabled = requests.length;
      assert.equal((await worker.processNotificationEmails(25)).enabled, false); assert.equal(requests.length, beforeDisabled);
    } finally {
      global.fetch = originalFetch;
      for (const [key, value] of Object.entries(saved)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
      await new Promise(resolve => server.close(resolve));
    }
  });
});
