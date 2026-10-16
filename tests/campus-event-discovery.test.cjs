const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
function load(file) {
  const m = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(name => name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), m, m.exports);
  return m.exports;
}
const { calendarEventFile } = load('lib/ical.ts');
const { newYorkInstant, eventDateLabel } = load('lib/campus-events.ts');
test('calendar keeps actual overnight, multi-day and DST instants without availability-hour restrictions', () => {
  for (const [start, end, expectedStart, expectedEnd] of [
    ['2026-10-16T23:30', '2026-10-17T02:30', '20261017T033000Z', '20261017T063000Z'],
    ['2026-03-08T01:30', '2026-03-08T03:30', '20260308T063000Z', '20260308T073000Z'],
    ['2026-11-01T00:30', '2026-11-02T01:30', '20261101T043000Z', '20261102T063000Z'],
  ]) {
    const output = calendarEventFile({ id: 'event', title: 'Campus evening', description: 'Details', location: 'Hall', start: newYorkInstant(start), end: newYorkInstant(end) });
    assert.ok(output.includes(`DTSTART:${expectedStart}\r\n`)); assert.ok(output.includes(`DTEND:${expectedEnd}\r\n`));
    assert.ok(output.endsWith('END:VCALENDAR\r\n'));
  }
  assert.match(eventDateLabel('2026-10-17T03:30:00Z'), /Oct 16/);
});
test('calendar TEXT is escaped, Unicode lines fold by UTF-8 octets, and invalid dates reject', () => {
  const title = 'Evening, arts; café 🎨 '.repeat(15);
  const event = { id: 'id', title, description: 'Line 1\r\nLine 2\\end', location: 'Hall; lawn', start: new Date('2026-10-17T03:00Z'), end: new Date('2026-10-17T05:00Z') };
  const output = calendarEventFile(event);
  for (const line of output.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
  const unfolded = output.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('Evening\\, arts\\; café 🎨'));
  assert.ok(unfolded.includes('DESCRIPTION:Line 1\\nLine 2\\\\end'));
  assert.throws(() => calendarEventFile({ ...event, end: new Date('invalid') }), /Invalid/);
  assert.throws(() => calendarEventFile({ ...event, end: new Date('2000-01-01') }), /Invalid/);
});
test('saved-event migration enforces uniqueness, cascading cleanup and server-only access even with permissive browser grants', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app; CREATE TABLE "User" (id TEXT PRIMARY KEY); CREATE TABLE "Event" (id TEXT PRIMARY KEY); INSERT INTO "User" VALUES (\'student\'); INSERT INTO "Event" VALUES (\'event\');');
    await db.exec(fs.readFileSync('prisma/migrations/20261016010000_saved_campus_events/migration.sql', 'utf8'));
    await db.exec('INSERT INTO "SavedCampusEvent" ("userId", "eventId") VALUES (\'student\', \'event\');');
    await assert.rejects(db.exec('INSERT INTO "SavedCampusEvent" ("userId", "eventId") VALUES (\'student\', \'event\');'), /duplicate/);
    await db.exec('GRANT ALL ON "SavedCampusEvent" TO anon, authenticated; CREATE POLICY overly_permissive ON "SavedCampusEvent" FOR ALL TO PUBLIC USING (true) WITH CHECK (true);');
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      assert.equal((await db.query('SELECT * FROM "SavedCampusEvent"')).rows.length, 0);
      assert.equal((await db.query('DELETE FROM "SavedCampusEvent" RETURNING *')).rows.length, 0);
      await assert.rejects(db.exec('INSERT INTO "SavedCampusEvent" ("userId", "eventId") VALUES (\'student\', \'event\');'), /row-level security/);
      await db.exec('RESET ROLE');
    }
    await db.exec('SET ROLE outclass_production_app');
    assert.equal((await db.query('SELECT * FROM "SavedCampusEvent"')).rows.length, 1);
    await db.exec('RESET ROLE; DELETE FROM "Event"');
    assert.equal((await db.query('SELECT * FROM "SavedCampusEvent"')).rows.length, 0);
  } finally { await db.close(); }
});
test('native Prisma: account-scoped idempotent saves, shared filtered pagination, publication restrictions and existing RSVP', { skip: !process.env.OUTCLASS_EVENTS_TEST_DATABASE_URL }, async () => {
  const h = await require('./helpers/campus-events-native.cjs').campusEventsNative(process.env.OUTCLASS_EVENTS_TEST_DATABASE_URL);
  try {
    const events = await h.seed(65), event = events[0];
    const first = await h.api.getPublicCorkboard({ clubId: h.club.id });
    const second = await h.api.getPublicCorkboard({ clubId: h.club.id, page: 1 });
    assert.equal(first.events.length, 60); assert.equal(second.events.length, 5); assert.ok(first.hasMore);
    assert.equal(new Set([...first.events, ...second.events].map(e => e.id)).size, 65);
    await h.api.setSavedCampusEvent({ eventId: event.id, saved: true });
    await h.api.setSavedCampusEvent({ eventId: event.id, saved: true });
    assert.deepEqual(await h.api.getSavedCampusEventIds(), [event.id]);
    assert.equal((await h.api.getPublicCorkboard({ savedOnly: true })).total, 1);
    assert.equal((await h.api.getPublicCorkboard({ savedOnly: true, category: 'Sports' })).total, 0);
    assert.equal((await h.api.getPublicCorkboard({ savedOnly: true, query: 'Art Museum', clubId: h.club.id, sort: 'name' })).events[0].id, event.id);
    h.as(h.users[1]);
    assert.deepEqual(await h.api.getSavedCampusEventIds(), []);
    assert.equal((await h.api.getPublicCorkboard({ savedOnly: true })).total, 0);
    await h.api.setSavedCampusEvent({ eventId: event.id, saved: false });
    h.as(h.users[0]); assert.deepEqual(await h.api.getSavedCampusEventIds(), [event.id]);
    const rsvp = await h.api.setCampusEventRsvp({ eventId: event.id, going: true });
    assert.equal(rsvp.going, true); assert.equal(rsvp.count, 1);
    assert.equal((await h.api.getPublicCampusEvent(event.id)).rsvpCount, 1);
    assert.equal((await h.api.setCampusEventRsvp({ eventId: event.id, going: false })).count, 0);
    await h.prisma.eventPublication.update({ where: { eventId: event.id }, data: { status: 'CANCELLED' } });
    assert.equal(await h.api.getPublicCampusEvent(event.id), null);
    assert.equal((await h.api.getPublicCorkboard({ savedOnly: true })).total, 0);
    await assert.rejects(h.api.setSavedCampusEvent({ eventId: event.id, saved: true }), /no longer available/);
    await h.api.setSavedCampusEvent({ eventId: event.id, saved: false });
    assert.deepEqual(await h.api.getSavedCampusEventIds(), []);
    await assert.rejects(h.api.setSavedCampusEvent({ eventId: events[1].id, saved: true, userId: h.users[1] }));
    h.as(null); await assert.rejects(h.api.getSavedCampusEventIds(), /Sign in/);
    await assert.rejects(h.api.getPublicCorkboard({ savedOnly: true }), /Sign in/);
  } finally { await h.close(); }
});
