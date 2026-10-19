const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const { Actor, readConfig, randomUUID } = require('./helpers/onboarding-e2e.cjs');
const { loader } = require('./helpers/communications-loader.cjs');
const filename = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;

test('real account HTTP and RSC keep internal templates behind recruiting permission across campuses and overlapping memberships', { skip: !filename, timeout: 60000 }, async t => {
  const config = readConfig(filename), db = new PrismaClient({ datasourceUrl: config.status.DB_URL });
  t.after(() => db.$disconnect());
  const admin = createClient(config.status.API_URL, config.status.SECRET_KEY, { auth: { persistSession: false } });
  const people = [];
  for (const label of ['a', 'b']) {
    const email = `projection.${label}.${randomUUID()}@virginia.edu`, password = 'Disposable-only!' + randomUUID();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.ok(!error, 'Local fixture account creation');
    await db.user.create({ data: { id: data.user.id, email, studentProfile: { create: { firstName: 'Synthetic', lastName: label, computingId: email.split('@')[0], major: 'Economics', gradYear: 2028 } } } });
    const actor = new Actor(config); await actor.signIn(email, password); people.push({ id: data.user.id, actor });
  }
  const schools = await Promise.all(['a', 'b'].map(label => db.school.create({ data: { key: 'projection-' + randomUUID(), name: 'Synthetic campus ' + label } })));
  const markers = schools.map(() => 'PRIVATE-TEMPLATE-' + randomUUID());
  const clubs = await Promise.all(schools.map((school, index) => db.club.create({ data: { schoolId: school.id, campusKey: school.key, slug: randomUUID(), name: 'Projection fixture ' + index, tagline: '', description: '', color: '#142d45', category: 'Other', decisionLetterTemplates: { ACCEPTED: { title: 'Internal draft', body: markers[index], closing: '', signer: '', footer: '' } } } })));
  for (const [index, club] of clubs.entries()) {
    const round = await db.pipelineRound.create({ data: { clubId: club.id, name: 'Review', order: 0 } });
    await db.application.create({ data: { studentId: people[index].id, clubId: club.id, roundId: round.id, status: 'SUBMITTED' } });
    for (const person of people) await db.clubMember.create({ data: { userId: person.id, clubId: club.id, accessRole: 'MEMBER', permissions: [] } });
  }
  const assertPrivate = async person => {
    const response = await person.actor.request('/api/users/me'); assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.ok(response.headers.get('vary').split(/\s*,\s*/).includes('Cookie'));
    const body = await response.json(); assert.equal(body.id, person.id); assert.equal(body.applications.length, 1); assert.equal(body.applications[0].studentId, person.id); assert.equal(body.memberships.length, 2);
    for (const record of [...body.memberships, ...body.applications, ...body.adminRoles]) assert.equal(Object.hasOwn(record.club, 'decisionLetterTemplates'), false);
    const page = await person.actor.request('/'), html = await page.text(); assert.equal(page.status, 200);
    for (const marker of markers) assert.ok(!html.includes(marker), 'Initial server-rendered account data must omit internal drafts');
    return body;
  };
  await t.test('students see only their own applications; ordinary overlapping memberships expose no internal drafts in HTTP or RSC', async () => {
    for (const person of people) { const body = await assertPrivate(person); assert.equal(body.adminRoles.length, 0); }
    for (const club of clubs) await assert.rejects(people[0].actor.action('actions/communications.ts', 'getDecisionTemplates', [club.id]));
  });
  await t.test('recruiter can use the dedicated template reader only in the authorized club; common payloads stay redacted', async () => {
    await db.clubMember.update({ where: { userId_clubId: { userId: people[0].id, clubId: clubs[0].id } }, data: { accessRole: 'RECRUITING_ADMIN', permissions: ['recruitment.manage'] } });
    const body = await assertPrivate(people[0]); assert.equal(body.adminRoles.length, 1);
    const template = await people[0].actor.action('actions/communications.ts', 'getDecisionTemplates', [clubs[0].id]); assert.equal(template.templates.ACCEPTED.body, markers[0]);
    await assert.rejects(people[0].actor.action('actions/communications.ts', 'getDecisionTemplates', [clubs[1].id]));
    await assertPrivate(people[1]);
  });
  await t.test('owner retains the editor and navigation fields without widening account serialization', async () => {
    await db.clubMember.update({ where: { userId_clubId: { userId: people[0].id, clubId: clubs[0].id } }, data: { accessRole: 'OWNER', isOwner: true } });
    const body = await assertPrivate(people[0]); assert.equal(body.adminRoles.length, 1); assert.equal(body.adminRoles[0].club.invitationEmailEnabled, true); assert.equal(body.adminRoles[0].club.pipelineVersion, 0);
    const template = await people[0].actor.action('actions/communications.ts', 'getDecisionTemplates', [clubs[0].id]); assert.equal(template.templates.ACCEPTED.body, markers[0]);
  });
  await t.test('unauthenticated account responses are private and non-cacheable', async () => {
    const visitor = new Actor(config), response = await visitor.request('/api/users/me'); assert.equal(response.status, 401); assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.ok(response.headers.get('vary').split(/\s*,\s*/).includes('Cookie'));
  });
  await t.test('native Prisma notification snapshots use two statements, preserve counts and reject disabled accounts', async () => {
    let calls = 0;
    const snapshot = loader({ '@/utils/prisma': { prisma: { $queryRaw: (...args) => { calls++; return db.$queryRaw(...args); } } } })('lib/communications-snapshot.ts');
    await db.userNotification.createMany({ data: [
      { userId: people[0].id, eventKey: 'snapshot-unread-' + randomUUID(), type: 'PLATFORM', title: 'Synthetic', body: '', href: '/' },
      { userId: people[0].id, eventKey: 'snapshot-read-' + randomUUID(), type: 'PLATFORM', title: 'Synthetic', body: '', href: '/', readAt: new Date() },
      { userId: people[0].id, eventKey: 'snapshot-archived-' + randomUUID(), type: 'PLATFORM', title: 'Synthetic', body: '', href: '/', archivedAt: new Date() },
    ] });
    const result = await snapshot.communicationsSnapshot(people[0].id);
    assert.equal(calls, 2); assert.equal(typeof result.unread, 'number');
    assert.equal(result.unread, await db.userNotification.count({ where: { userId: people[0].id, archivedAt: null, readAt: null } }));
    assert.match(result.revision, /^[a-f0-9]{64}$/);
    const notifications = await db.userNotification.aggregate({ where: { userId: people[0].id }, _count: { id: true }, _max: { updatedAt: true } });
    // These new accounts have no historical conversations. Verify the exact
    // pre-batching hash, including Prisma's actual timestamp representation.
    assert.equal(await db.clubConversation.count({ where: { studentId: people[0].id } }), 0);
    const expectedRevision = require('node:crypto').createHash('sha256').update(JSON.stringify([notifications._count.id, notifications._max.updatedAt, result.unread, [[null, '0']]])).digest('hex');
    assert.equal(result.revision, expectedRevision);
    await db.user.update({ where: { id: people[1].id }, data: { disabledAt: new Date() } });
    await assert.rejects(snapshot.communicationsSnapshot(people[1].id), /unavailable/);
  });
});
