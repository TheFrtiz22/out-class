const { test } = require('node:test'), assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const { Actor, randomUUID } = require('./helpers/onboarding-e2e.cjs');
const { readConfig } = require('./helpers/announcement-e2e.cjs');
const { loader } = require('./helpers/communications-loader.cjs');
const configFile = process.env.OUTCLASS_ANNOUNCEMENT_E2E_CONFIG;

test('announcements over real Next HTTP, verified local Auth and PostgreSQL; provider delivery is mocked', { skip: !configFile, timeout: 180000 }, async t => {
  const config = readConfig(configFile), db = new PrismaClient({ datasourceUrl: config.status.DB_URL });
  t.after(() => db.$disconnect());
  const admin = createClient(config.status.API_URL, config.status.SECRET_KEY, { auth: { persistSession: false } });
  const suffix = randomUUID().slice(0, 8), users = {}, actors = {};
  for (const role of ['owner', 'member', 'applicant', 'foreign', 'draft', 'disabled']) {
    const email = `${role}-${suffix}@virginia.edu`, password = 'Local-only!' + randomUUID();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error; assert.ok(data.user.email_confirmed_at);
    users[role] = await db.user.upsert({ where: { id: data.user.id }, create: { id: data.user.id, email }, update: {} });
    const actor = new Actor(config); await actor.signIn(email, password); actors[role] = actor;
  }
  const club = await db.club.create({ data: { slug: 'announcement-' + suffix, name: 'Announcement Fixture', tagline: '', description: '', category: 'Academic', color: '#142d4e' } });
  const foreign = await db.club.create({ data: { slug: 'foreign-' + suffix, name: 'Foreign Fixture', tagline: '', description: '', category: 'Academic', color: '#142d4e' } });
  for (const [role, clubId, isOwner] of [['owner', club.id, true], ['member', club.id, false], ['foreign', foreign.id, true]]) await db.clubMember.create({ data: { userId: users[role].id, clubId, isOwner, accessRole: isOwner ? 'OWNER' : 'MEMBER' } });
  const round = await db.pipelineRound.create({ data: { clubId: club.id, name: 'Review', order: 0 } });
  for (const role of ['applicant', 'draft', 'disabled']) await db.application.create({ data: { studentId: users[role].id, clubId: club.id, roundId: round.id, status: role === 'draft' ? 'DRAFTING' : 'SUBMITTED', submittedAt: role === 'draft' ? null : new Date() } });
  await db.user.update({ where: { id: users.disabled.id }, data: { disabledAt: new Date() } });
  const call = (role, name, ...args) => actors[role].action('actions/communications.ts', name, args);
  const input = { clubId: club.id, title: 'HTTP announcement', body: 'Persistent announcement body', audience: 'APPLICANTS', requestKey: randomUUID() };
  let published, notification;

  await t.test('publication retries are atomic, idempotent and confined to one eligible applicant', async () => {
    const results = await Promise.all([call('owner', 'publishClubAnnouncement', input), call('owner', 'publishClubAnnouncement', input)]);
    assert.equal(results[0].id, results[1].id); published = results[0]; assert.equal(published.recipientCount, 1);
    assert.equal(await db.clubAnnouncement.count({ where: { clubId: club.id } }), 1);
    const rows = await db.userNotification.findMany({ where: { announcementId: published.id }, include: { emailOutbox: true } });
    assert.equal(rows.length, 1); notification = rows[0]; assert.equal(notification.userId, users.applicant.id); assert.equal(notification.emailOutbox.status, 'PENDING');
    const history = await call('owner', 'getClubAnnouncements', club.id); assert.equal(history[0]._count.notifications, 1); assert.equal(history[0].body, input.body);
    await assert.rejects(call('owner', 'publishClubAnnouncement', { ...input, body: 'Changed retry' }));
  });
  assert.ok(notification, 'Publication prerequisite');
  await t.test('club permissions, forged audience, suspension, disabled accounts and notification ownership fail closed', async () => {
    for (const role of ['member', 'applicant', 'foreign', 'disabled']) {
      await assert.rejects(call(role, 'publishClubAnnouncement', { ...input, requestKey: randomUUID() }));
      await assert.rejects(call(role, 'getClubAnnouncements', club.id));
    }
    await assert.rejects(call('owner', 'publishClubAnnouncement', { ...input, studentId: users.foreign.id }));
    await assert.rejects(call('owner', 'publishClubAnnouncement', { ...input, clubId: foreign.id }));
    const anonymous = new Actor(config); await assert.rejects(anonymous.action('actions/communications.ts', 'getDurableNotifications', []));
    await db.club.update({ where: { id: club.id }, data: { suspendedAt: new Date() } });
    await assert.rejects(call('owner', 'publishClubAnnouncement', { ...input, requestKey: randomUUID() }));
    await db.club.update({ where: { id: club.id }, data: { suspendedAt: null } });
    assert.equal((await call('foreign', 'setDurableNotificationsRead', [notification.id], true)).updated, 0);
    await assert.rejects(call('foreign', 'getDurableNotifications', notification.id));
    assert.ok(!(await call('foreign', 'getDurableNotifications')).items.some(row => row.id === notification.id));
    const response = await fetch(config.status.API_URL + '/rest/v1/UserNotification?select=*', { headers: { apikey: config.status.PUBLISHABLE_KEY, authorization: 'Bearer ' + (await actors.applicant.client.auth.getSession()).data.session.access_token } });
    assert.ok([401, 403].includes(response.status), 'Browser database roles cannot bypass server ownership');
    for (const name of ['findCommunicationRecipients', 'startClubConversation', 'listClubConversations', 'getClubConversation', 'sendClubMessage']) await assert.rejects(call('owner', name));
    assert.equal(await db.clubConversation.count(), 0);
  });
  await t.test('inbox read/unread and preference updates persist through new authenticated requests', async () => {
    const before = await call('applicant', 'getDurableNotifications'); assert.ok(before.items.some(row => row.id === notification.id && row.body === input.body));
    await call('applicant', 'setDurableNotificationsRead', [notification.id], true);
    assert.ok((await db.userNotification.findUnique({ where: { id: notification.id } })).readAt);
    assert.equal((await call('applicant', 'getDurableNotifications')).unread, before.unread - 1);
    await call('applicant', 'setDurableNotificationsRead', [notification.id], false);
    assert.equal((await call('applicant', 'getDurableNotifications')).unread, before.unread);
    await assert.rejects(call('applicant', 'saveNotificationPreferences', { userId: users.foreign.id }));
  });

  await t.test('mocked worker covers OFF, daily aggregation, retries, leases, uncertain outcomes and account changes', async () => {
    // Isolate all fixtures from the approved UI event and the real-email ledger.
    await db.notificationEmailOutbox.updateMany({ where: { status: 'PENDING', notification: { userId: { in: Object.values(users).map(u => u.id) } } }, data: { status: 'SUPPRESSED' } });
    const requests = [], accepted = new Map(); let mode = 'success';
    const original = global.fetch, keys = ['COMMUNICATIONS_EMAIL_ENABLED', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'OUTCLASS_SITE_URL'], saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
    Object.assign(process.env, { COMMUNICATIONS_EMAIL_ENABLED: 'true', RESEND_API_KEY: 'mock-only', RESEND_FROM_EMAIL: 'fixture@virginia.edu', OUTCLASS_SITE_URL: config.appUrl });
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://api.resend.com/emails', 'No network calls from mocked provider');
      const key = options.headers['Idempotency-Key']; requests.push({ key, body: options.body });
      if (mode === 'retry') return new Response('{}', { status: 429, headers: { 'retry-after': '0' } });
      if (mode === 'reject') return new Response('{}', { status: 422 });
      if (accepted.has(key)) assert.equal(accepted.get(key).body, options.body); else accepted.set(key, { id: randomUUID(), body: options.body });
      if (mode === 'lost') throw Error('Provider accepted; response lost');
      return Response.json({ id: accepted.get(key).id });
    };
    const worker = loader({ '@/utils/prisma': { prisma: db } })('utils/notification-delivery.ts');
    const preferences = { emailAnnouncements: true, emailMessages: false, emailApplications: true, emailInterviews: true, emailInvitations: true, emailTasks: true, emailPlatform: false, emailFrequency: 'INSTANT' };
    const setPrefs = values => db.userNotificationPreference.upsert({ where: { userId: users.applicant.id }, create: { userId: users.applicant.id, ...preferences, ...values }, update: { ...preferences, ...values } });
    const notify = () => db.userNotification.create({ data: { userId: users.applicant.id, clubId: club.id, eventKey: 'mock:' + randomUUID(), type: 'ANNOUNCEMENT', title: 'Mock update', body: 'In-app only body', href: '/?workspace=student&view=inbox' } });
    const receipt = id => db.notificationEmailOutbox.findUnique({ where: { notificationId: id }, include: { delivery: true } });
    try {
      await setPrefs({ emailAnnouncements: false }); const off = await notify(); await worker.processNotificationEmails(25);
      assert.equal((await receipt(off.id)).status, 'SUPPRESSED'); assert.ok(await db.userNotification.findUnique({ where: { id: off.id } })); assert.equal(requests.length, 0);
      await setPrefs({ emailFrequency: 'OFF' }); const globalOff = await notify(); await worker.processNotificationEmails(25); assert.equal((await receipt(globalOff.id)).status, 'SUPPRESSED'); assert.equal(requests.length, 0);
      await setPrefs({ emailFrequency: 'DAILY' }); const daily = await Promise.all([notify(), notify()]); await worker.processNotificationEmails(25); assert.equal(requests.length, 0);
      await db.notificationEmailOutbox.updateMany({ where: { notificationId: { in: daily.map(n => n.id) } }, data: { createdAt: new Date(Date.now() - 86400000) } });
      await Promise.all([worker.processNotificationEmails(25), worker.processNotificationEmails(25)]);
      const digest = await Promise.all(daily.map(n => receipt(n.id))); assert.equal(digest[0].deliveryId, digest[1].deliveryId); assert.equal(digest[0].delivery.status, 'SENT'); assert.equal(requests.length, 1);
      assert.equal(JSON.parse(requests[0].body).subject, 'Your daily OutClass updates');
      await setPrefs({}); mode = 'retry'; const retry = await notify(); await worker.processNotificationEmails(25); const first = await receipt(retry.id);
      assert.equal(first.delivery.status, 'QUEUED'); assert.ok(first.delivery.nextAttemptAt > new Date());
      await db.notificationEmailDelivery.update({ where: { id: first.deliveryId }, data: { nextAttemptAt: new Date(0) } }); mode = 'success';
      await Promise.all([worker.processNotificationEmails(25), worker.processNotificationEmails(25)]); const sent = (await receipt(retry.id)).delivery;
      assert.equal(sent.status, 'SENT'); assert.equal(sent.attemptCount, 2); assert.equal(requests.at(-1).key, requests.at(-2).key); assert.equal(requests.at(-1).body, requests.at(-2).body);
      const count = accepted.size; await db.notificationEmailDelivery.update({ where: { id: sent.id }, data: { status: 'SENDING', leaseUntil: new Date(0), leaseToken: randomUUID() } }); await worker.processNotificationEmails(25); assert.equal(accepted.size, count);
      mode = 'lost'; const lost = await notify(); await worker.processNotificationEmails(25); const unknown = await receipt(lost.id); const before = requests.length;
      await db.notificationEmailDelivery.update({ where: { id: unknown.deliveryId }, data: { nextAttemptAt: new Date(0), firstAttemptAt: new Date(Date.now() - 24 * 3600000) } }); mode = 'success'; await worker.processNotificationEmails(25);
      assert.equal(requests.length, before); assert.equal((await receipt(lost.id)).delivery.status, 'UNCERTAIN'); assert.ok(await db.userNotification.findUnique({ where: { id: lost.id } }));
      mode = 'reject'; const permanent = await notify(); await worker.processNotificationEmails(25); assert.equal((await receipt(permanent.id)).delivery.status, 'FAILED');
      assert.ok(await db.userNotification.findUnique({ where: { id: permanent.id } }));
      mode = 'retry'; const optedOut = await notify(); await worker.processNotificationEmails(25); const beforeOptOut = await receipt(optedOut.id);
      await db.notificationEmailDelivery.update({ where: { id: beforeOptOut.deliveryId }, data: { nextAttemptAt: new Date(0) } });
      await setPrefs({ emailAnnouncements: false }); mode = 'success'; const optOutCalls = requests.length; await worker.processNotificationEmails(25);
      assert.equal(requests.length, optOutCalls); assert.equal((await receipt(optedOut.id)).delivery.status, 'SUPPRESSED');
      await setPrefs({});
      mode = 'retry'; const changed = await notify(); await worker.processNotificationEmails(25); const queued = await receipt(changed.id);
      await db.notificationEmailDelivery.update({ where: { id: queued.deliveryId }, data: { nextAttemptAt: new Date(0) } });
      await db.club.update({ where: { id: club.id }, data: { suspendedAt: new Date() } }); mode = 'success'; const held = requests.length; await worker.processNotificationEmails(25); assert.equal(requests.length, held);
      await db.club.update({ where: { id: club.id }, data: { suspendedAt: null } }); await db.user.update({ where: { id: users.applicant.id }, data: { disabledAt: new Date() } }); await worker.processNotificationEmails(25);
      assert.equal(requests.length, held); assert.equal((await receipt(changed.id)).delivery.status, 'SUPPRESSED');
      assert.ok(requests.every(r => !r.body.includes('In-app only body')));
      assert.ok(requests.every(r => JSON.parse(r.body).to === users.applicant.email), 'Mocks never process the approved real event');
    } finally {
      global.fetch = original; for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });
});
