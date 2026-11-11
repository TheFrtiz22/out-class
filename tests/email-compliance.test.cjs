// Email compliance: footer address and preferences link, List-Unsubscribe on optional email only,
// signed one-click unsubscribe that can only turn email off, and no dashes in subjects or senders.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { loader } = require('./helpers/communications-loader.cjs');
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const site = 'https://www.outclass.test', ADDRESS = '1 Example Way, Charlottesville, VA 22903';
const SECRET = 'test-unsubscribe-secret-0123456789abcdef';
function withEnv(values, fn) {
  const prior = Object.fromEntries(Object.keys(values).map(k => [k, process.env[k]]));
  for (const [k, v] of Object.entries(values)) v === undefined ? delete process.env[k] : process.env[k] = v;
  const restore = () => { for (const [k, v] of Object.entries(prior)) v === undefined ? delete process.env[k] : process.env[k] = v; };
  try { const out = fn(); if (out && typeof out.then === 'function') return out.finally(restore); restore(); return out; } catch (e) { restore(); throw e; }
}
const quiet = fn => { const warn = console.warn, seen = []; console.warn = (...a) => seen.push(a.join(' ')); try { fn(); } finally { console.warn = warn; } return seen; };
function allTemplates() {
  const load = loader({}), out = [];
  for (const [type, m] of Object.entries(load('lib/auth-email-templates.ts').authEmailTemplates(site))) out.push({ name: `auth:${type}`, ...m });
  out.push({ name: 'invitation', ...load('lib/invitation-email.ts').invitationEmail({ organizationName: 'Club', owner: false, siteUrl: site }) });
  out.push({ name: 'student-claim', ...load('lib/student-claim-email.ts').studentClaimEmail({ recipient: 's@virginia.edu', name: 'Sam', tokenHash: 'a'.repeat(56), deliveryId: uuid(9), siteUrl: site }) });
  const email = load('lib/notification-email.ts'), base = { from: 'n@out-class.net', to: 's@virginia.edu', siteUrl: site, userId: uuid(1) }, club = { name: 'Club' };
  out.push({ name: 'decision', ...email.buildNotificationEmail({ ...base, digest: false, items: [{ type: 'DECISION', title: 'x', club, href: `/applications/${uuid(2)}/decision` }] }) });
  out.push({ name: 'update', ...email.buildNotificationEmail({ ...base, digest: false, items: [{ type: 'MESSAGE', title: 'Hi', club }] }) });
  out.push({ name: 'announcement', ...email.buildNotificationEmail({ ...base, digest: false, items: [{ type: 'ANNOUNCEMENT', title: 'News', club }] }) });
  out.push({ name: 'digest', ...email.buildNotificationEmail({ ...base, digest: true, items: [{ type: 'TASK', title: 'Due', club }] }) });
  out.push({ name: 'panel', ...email.buildNotificationEmail({ ...base, digest: false, items: [{ type: 'INTERVIEW', title: 'Panel', club, panelSchedule: { notificationId: uuid(3), signature: 'a'.repeat(64), href: `/settings/interviews?clubId=${uuid(4)}&roundId=${uuid(5)}`, details: ['Monday'] } }] }) });
  return out;
}

test('every email template footer carries the preferences link and, when set, the mailing address', () => {
  withEnv({ OUTCLASS_POSTAL_ADDRESS: ADDRESS }, () => {
    for (const m of allTemplates()) {
      assert.ok(m.html.includes(`href="${site}/inbox?tab=preferences"`), `${m.name}: preferences link`);
      assert.ok(m.html.includes(`OutClassPlatforms LLC, ${ADDRESS}`), `${m.name}: html address`);
      assert.ok(m.text.includes(ADDRESS), `${m.name}: text address`);
    }
  });
  // Markup in the address is escaped, never rendered.
  withEnv({ OUTCLASS_POSTAL_ADDRESS: '<b>1 Way</b>' }, () => {
    const html = loader({})('lib/student-claim-email.ts').studentClaimEmail({ recipient: 's@virginia.edu', name: 'Sam', tokenHash: 'a'.repeat(56), deliveryId: uuid(9), siteUrl: site }).html;
    assert.ok(html.includes('&lt;b&gt;1 Way&lt;/b&gt;')); assert.ok(!html.includes('<b>1 Way'));
  });
});

test('without OUTCLASS_POSTAL_ADDRESS the address line is omitted and one warning is logged', () => {
  withEnv({ OUTCLASS_POSTAL_ADDRESS: undefined }, () => {
    let templates;
    const warnings = quiet(() => { templates = allTemplates(); templates = templates.concat(allTemplates()); });
    for (const m of templates) { assert.ok(m.html.includes('OutClassPlatforms LLC</p>'), m.name); assert.ok(m.html.includes('/inbox?tab=preferences'), m.name); }
    // One loader instance per allTemplates call shares a module; each instance warns once at most.
    assert.equal(warnings.filter(w => /OUTCLASS_POSTAL_ADDRESS/.test(w)).length, 2);
    const single = loader({})('lib/transactional-email.ts');
    assert.equal(quiet(() => { single.emailPostalAddress(); single.emailPostalAddress(); single.emailPostalAddress(); }).length, 1);
  });
  assert.match(fs.readFileSync('.env.example', 'utf8'), /^OUTCLASS_POSTAL_ADDRESS=""$/m);
  assert.match(fs.readFileSync('.env.example', 'utf8'), /^EMAIL_UNSUBSCRIBE_SECRET=""$/m);
});

test('List-Unsubscribe is on digests and announcements and absent on transactional email', () => {
  withEnv({ EMAIL_UNSUBSCRIBE_SECRET: SECRET, OUTCLASS_POSTAL_ADDRESS: ADDRESS }, () => {
    const byName = Object.fromEntries(allTemplates().map(m => [m.name, m]));
    for (const name of ['digest', 'announcement']) {
      const h = byName[name].headers;
      assert.ok(h, name); assert.equal(h['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
      assert.match(h['List-Unsubscribe'], new RegExp(`^<${site}/api/email/unsubscribe\\?token=[\\w.-]+>, <${site}/inbox\\?tab=preferences>$`));
    }
    for (const name of ['decision', 'update', 'panel', 'invitation', 'student-claim', ...Object.keys(byName).filter(n => n.startsWith('auth:'))]) assert.equal(byName[name].headers, undefined, name);
    const email = loader({})('lib/notification-email.ts');
    // The header survives the persisted-payload schema and reaches Resend unchanged.
    const parsed = email.notificationEmailPayload.parse(JSON.parse(JSON.stringify(byName.digest)));
    assert.deepEqual(parsed.headers, byName.digest.headers);
    assert.throws(() => email.notificationEmailPayload.parse({ ...byName.digest, headers: { Bcc: 'x@example.com' } }));
    // A panel digest is still a digest.
    const panelDigest = email.buildNotificationEmail({ from: 'n@out-class.net', to: 's@virginia.edu', siteUrl: site, userId: uuid(1), digest: true, items: [{ type: 'INTERVIEW', title: 'Panel', club: null, panelSchedule: { notificationId: uuid(3), signature: 'a'.repeat(64), href: `/settings/interviews?clubId=${uuid(4)}&roundId=${uuid(5)}`, details: [] } }] });
    assert.ok(panelDigest.headers['List-Unsubscribe']);
  });
  withEnv({ EMAIL_UNSUBSCRIBE_SECRET: undefined }, () => quiet(() => {
    const digest = loader({})('lib/notification-email.ts').buildNotificationEmail({ from: 'n@out-class.net', to: 's@virginia.edu', siteUrl: site, userId: uuid(1), digest: true, items: [{ type: 'TASK', title: 'Due', club: null }] });
    assert.deepEqual(digest.headers, { 'List-Unsubscribe': `<${site}/inbox?tab=preferences>` });
  }));
  assert.match(fs.readFileSync('utils/notification-delivery.ts', 'utf8'), /buildNotificationEmail\(\{[^}]*userId: user\.id/);
});

test('sendNotificationEmail forwards List-Unsubscribe headers to Resend', async () => {
  await withEnv({ EMAIL_UNSUBSCRIBE_SECRET: SECRET }, async () => {
    const email = loader({})('lib/notification-email.ts');
    const payload = email.buildNotificationEmail({ from: 'n@out-class.net', to: 's@virginia.edu', siteUrl: site, userId: uuid(1), digest: true, items: [{ type: 'TASK', title: 'Due', club: null }] });
    const original = global.fetch; let body;
    global.fetch = async (_url, options) => { body = JSON.parse(options.body); return Response.json({ id: 'receipt' }); };
    try { await email.sendNotificationEmail(payload, uuid(7), 'key'); } finally { global.fetch = original; }
    assert.deepEqual(body.headers, payload.headers); assert.equal(body.digest, undefined); assert.equal(body.categories, undefined);
  });
});

test('unsubscribe tokens are signed, scoped and tamper-evident', () => {
  withEnv({ EMAIL_UNSUBSCRIBE_SECRET: SECRET }, () => {
    const u = loader({})('lib/email-unsubscribe.ts');
    const token = u.signUnsubscribeToken(uuid(1), 'digest');
    assert.deepEqual(u.verifyUnsubscribeToken(token), { userId: uuid(1), scope: 'digest' });
    const [body, sig] = token.split('.');
    const swapped = Buffer.from(`${uuid(2)}.digest`).toString('base64url') + '.' + sig;
    assert.equal(u.verifyUnsubscribeToken(swapped), null, 'another user id with the same signature');
    assert.equal(u.verifyUnsubscribeToken(Buffer.from(`${uuid(1)}.announcements`).toString('base64url') + '.' + sig), null, 'another scope');
    assert.equal(u.verifyUnsubscribeToken(body + '.' + sig.slice(0, -2)), null);
    for (const bad of [null, '', 'a.b.c', 'x'.repeat(400), body]) assert.equal(u.verifyUnsubscribeToken(bad), null);
    assert.throws(() => u.signUnsubscribeToken('not-a-uuid', 'digest'));
    withEnv({ EMAIL_UNSUBSCRIBE_SECRET: 'another-secret-0123456789abcdefghijkl' }, () => assert.equal(u.verifyUnsubscribeToken(token), null));
    withEnv({ EMAIL_UNSUBSCRIBE_SECRET: 'short' }, () => { assert.equal(u.signUnsubscribeToken(uuid(1), 'digest'), null); assert.equal(u.verifyUnsubscribeToken(token), null); });
  });
});

test('one-click route: GET never writes, POST turns off only the signed category, bad tokens change nothing', async () => {
  await withEnv({ EMAIL_UNSUBSCRIBE_SECRET: SECRET }, async () => {
    const writes = [];
    const load = loader({ '@/utils/notification-preferences': { writeNotificationPreferences: async (userId, values) => { writes.push({ userId, values }); return {}; } } });
    const route = load('app/api/email/unsubscribe/route.ts'), u = load('lib/email-unsubscribe.ts');
    const url = scope => `${site}/api/email/unsubscribe?token=${encodeURIComponent(u.signUnsubscribeToken(uuid(1), scope))}`;
    const get = await route.GET(new Request(url('digest')));
    assert.equal(get.status, 200); assert.match(await get.text(), /<form method="post"/); assert.equal(writes.length, 0);
    assert.equal((await route.POST(new Request(url('digest'), { method: 'POST', body: 'List-Unsubscribe=One-Click' }))).status, 200);
    assert.equal((await route.POST(new Request(url('announcements'), { method: 'POST', body: 'List-Unsubscribe=One-Click' }))).status, 200);
    assert.deepEqual(writes, [{ userId: uuid(1), values: { emailFrequency: 'OFF' } }, { userId: uuid(1), values: { emailAnnouncements: false } }]);
    for (const bad of [`${site}/api/email/unsubscribe`, `${site}/api/email/unsubscribe?token=forged.token`]) {
      assert.equal((await route.POST(new Request(bad, { method: 'POST' }))).status, 400);
      assert.equal((await route.GET(new Request(bad))).status, 400);
    }
    assert.equal(writes.length, 2);
    const response = await route.POST(new Request(url('digest'), { method: 'POST' }));
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('set-cookie'), null, 'never signs anyone in');
  });
  // The route only ever lowers email; the shared writer is the same one the settings action uses.
  const route = fs.readFileSync('app/api/email/unsubscribe/route.ts', 'utf8');
  assert.doesNotMatch(route, /createClient|requireAuth|supabase|cookies\(/);
  assert.match(fs.readFileSync('actions/communications.ts', 'utf8'), /const saved = await writeNotificationPreferences\(user\.id, values\)/);
  assert.match(fs.readFileSync('utils/notification-preferences.ts', 'utf8'), /SELECT id FROM "User" WHERE id=\$\{userId\} FOR UPDATE/);
});

test('email subjects and sender names carry no em or en dashes', () => {
  const load = loader({});
  for (const subject of Object.values(load('lib/auth-email-templates.ts').authEmailSubjects)) assert.doesNotMatch(subject, /[–—]/, subject);
  assert.doesNotMatch(fs.readFileSync('supabase/config.toml', 'utf8').split('\n').filter(l => /^\s*#?\s*subject\s*=/.test(l)).join('\n'), /[–—]/);
  const email = load('lib/notification-email.ts');
  const subject = email.buildNotificationEmail({ from: 'n@out-class.net', to: 's@virginia.edu', siteUrl: site, digest: false, items: [{ type: 'ANNOUNCEMENT', title: 'x', club: { name: 'Hoos — Consulting' } }] }).subject;
  assert.equal(subject, 'New announcement from Hoos - Consulting');
  for (const file of ['utils/email.ts', 'scripts/email-audit.cjs']) for (const m of fs.readFileSync(file, 'utf8').matchAll(/from: \{ name: '([^']+)'/g)) assert.doesNotMatch(m[1], /[–—]/);
});
